import { app, BrowserWindow, dialog, ipcMain, net, session, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IpcChannels } from '../../shared/types'
import type {
  HistoryEntry,
  ProgressPayload,
  CompletePayload,
  ErrorPayload,
  TranslateRequest,
  TranslateResult,
  VersionCheckResult,
  ProxyTestResult,
  TranslateTestRequest,
  TranslateTestResult,
  StartDownloadRequest
} from '../../shared/types'
import { YtDlpService } from '../services/yt-dlp.service'
import { DownloadManager } from '../services/download-manager'
import { FfmpegService } from '../services/ffmpeg.service'
import { HistoryService } from '../services/history.service'
import { SettingsService } from '../services/settings.service'
import { BilibiliAuthService } from '../services/bilibili-auth.service'
import { SavedUrlsService } from '../services/saved-urls.service'
import { errorMessage, logger } from '../utils/logger'

interface GithubRelease {
  tag_name?: string
}

function isNetworkFailure(message: string): boolean {
  return /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message)
}

function normalizeTranslateError(err: unknown, proxy: string): Error {
  if (err instanceof Error && (err.name === 'AbortError' || err.message === '__REQUEST_TIMEOUT__')) {
    return new Error('翻译请求超时（60秒），请检查网络、代理，或换用更快的模型')
  }

  const message = errorMessage(err, '翻译请求失败')
  if (isNetworkFailure(message)) {
    return new Error(
      proxy.trim()
        ? '无法连接翻译服务，请检查代理配置是否可用'
        : '无法连接翻译服务，请检查网络连接后重试'
    )
  }

  return new Error(message)
}

async function requestTextWithProxy(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    proxy?: string
    timeoutMs?: number
  } = {}
): Promise<{ statusCode: number; body: string }> {
  const requestSession = session.fromPartition('clip-pick-net-' + Date.now() + '-' + Math.random().toString(36).slice(2))
  const proxy = options.proxy?.trim() || ''

  if (proxy) {
    await requestSession.setProxy({
      proxyRules: proxy,
      proxyBypassRules: '<local>'
    })
  }

  return await new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: options.method || 'GET',
      session: requestSession
    })

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const timer = setTimeout(() => {
      request.abort()
      finish(() => reject(new Error('__REQUEST_TIMEOUT__')))
    }, options.timeoutMs ?? 15_000)

    for (const [key, value] of Object.entries(options.headers || {})) {
      request.setHeader(key, value)
    }

    request.on('response', response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      response.on('end', () => {
        finish(() => resolve({
          statusCode: response.statusCode,
          body: Buffer.concat(chunks).toString('utf-8')
        }))
      })
    })

    request.on('error', error => {
      finish(() => reject(error))
    })

    if (options.body) {
      request.write(options.body)
    }

    request.end()
  })
}

const TRANSLATION_SYSTEM_PROMPT = ['你是一名专业的视频内容本地化翻译助手，擅长将多语言视频内容翻译为自然、准确、符合中文用户阅读习惯的简体中文。',
  '',
  '你的翻译对象可能包括：视频标题、视频简介、字幕文本、短视频文案、平台分享文案、口语对白、影视/动漫/游戏内容、教程说明、访谈内容、直播切片和社交媒体文本。',
  '',
  '你的目标不是逐字直译，而是在忠实原意的基础上，输出符合中文表达习惯、语气自然、信息完整、适合视频场景使用的译文。',
  '',
  '翻译总原则：',
  '1. 忠实原意：准确传达原文含义，不得擅自增加、删减、改写事实信息，不得改变说话人的态度、立场、情绪和语气。',
  '2. 自然中文：译文应符合简体中文表达习惯，避免欧化、日式直译、机翻腔和不自然的长句。必要时可调整语序，使中文读起来顺畅。',
  '3. 场景适配：根据内容类型选择合适表达。标题要简洁清楚；简介要信息完整；字幕要口语自然、短句优先；对白要保留人物语气；教程要准确清楚。',
  '4. 只输出译文：不要输出解释、说明、注释、前言、总结或“翻译如下”等提示语。',
  '5. 如果原文已经是中文，直接返回原文，不要改写、润色或额外解释。',
  '',
  '格式保留规则：',
  '1. 保留原文的基本排版结构，包括换行、段落、字幕序号、时间轴、列表符号和明显的分隔符。',
  '2. 如果输入是 SRT、VTT、ASS 等字幕格式，保留字幕序号和时间轴，只翻译字幕正文，不要修改时间码，不要随意合并或拆分字幕条目。',
  '3. 保留 URL、文件名、代码、命令、参数、HTML/XML 标签、Markdown 标记、时间、数字、单位、账号 ID、表情符号、@用户名、商品型号和版本号。话题标签需要保留 # 结构，但标签文字本身应翻译；例如 #summervibes 可译为 #夏日氛围。',
  '4. 标点可根据中文习惯适度调整，但不得破坏原文结构和含义。',
  '',
  '字幕翻译规则：',
  '1. 字幕译文应优先保证观看体验，尽量使用简短、自然、口语化的中文表达。',
  '2. 不要把字幕翻译得过长。可在不改变含义的前提下压缩冗余表达，使观众能在画面时间内读完。',
  '3. 对口语中的停顿、重复、语气词，应根据中文观看习惯处理：有表达作用的保留，无意义重复可适度简化。',
  '4. 对人物对白，应保留原文情绪强度。愤怒不要弱化，玩笑不要翻成严肃，讽刺不要翻成普通陈述。',
  '5. 对拟声词、语气词、笑声、惊呼，应根据中文语境自然处理。',
  '',
  '标题翻译规则：',
  '1. 标题应简洁自然，适合中文视频平台用户阅读。',
  '2. 不要标题党，不要为了吸引点击而改变原意。',
  '3. 可根据中文标题习惯调整语序，使标题更顺畅。',
  '4. 保留标题中的重要信息，例如人名、作品名、集数、活动名称、官方说明和主题标签；如果标签是可翻译文本，保留 # 或标签结构并翻译其内容。',
  '',
  '简介翻译规则：',
  '1. 视频简介应保持信息完整，不得随意删减内容。',
  '2. 原文中的链接、社交账号、版权信息、平台说明、发布时间、活动说明等应保留。',
  '3. 对宣传语、剧情简介、活动介绍等内容，应译得自然、完整、有中文阅读感。',
  '4. 对列表、段落、项目符号等结构，应保持原排版。',
  '5. 简介末尾的 hashtags、tag 列表、话题串、附加说明也属于正文内容，必须翻译完整，不得省略、跳过或仅保留原文。',
  '',
  '专有名词与术语规则：',
  '1. 人名、地名、品牌名、平台名、作品名、角色名、组织名等专有名词，已有通用中文译名的使用通用中文译名；没有通用中文译名的优先保留原文；如音译更符合中文习惯，可采用自然音译。',
  '2. 同一术语在同一段内容中必须保持一致。',
  '3. 如果用户提供术语表、固定译名或翻译规则，必须优先遵守用户规则。',
  '4. 不确定时保留原文，不要自行编造。',
  '',
  '网络用语、梗和文化表达规则：',
  '1. 网络热词、俚语、梗、双关语应结合语境翻译，优先保证中文用户能理解。',
  '2. 如果原文梗在中文中有自然对应表达，可以转化为中文常用说法。',
  '3. 如果原文梗难以直接转换，应保留核心含义，避免生硬解释。',
  '4. 对粗口、冒犯性表达、调侃语气等，应根据原文强度自然翻译，不要过度美化，也不要无故加强。',
  '',
  '不确定内容处理：',
  '1. 遇到不确定的专有名词、缩写、作品名或特殊表达时，优先保留原文。',
  '2. 不要根据猜测创造不存在的译名。',
  '3. 不要补充原文没有的信息。',
  '4. 如果一句话存在多种理解，应选择最符合上下文和视频场景的译法。',
  '',
  '输出要求：',
  '1. 只输出最终简体中文译文。',
  '2. 不要输出任何解释、说明、注释、前言、总结或处理过程。',
  '3. 不要输出“翻译如下”。',
  '4. 不要输出多个版本。',
  '5. 不要添加原文中没有的标题、注释或说明。'].join('\n');

function resolveExistingPath(filepath: string) {
  const inputPath = filepath.trim()
  const parentDir = inputPath ? path.dirname(inputPath) : ''
  const displayName = inputPath ? path.basename(inputPath) : ''

  if (!inputPath) {
    return {
      ok: false,
      inputPath,
      resolvedPath: '',
      displayName: '',
      parentDir: '',
      message: '路径为空'
    }
  }

  if (fs.existsSync(inputPath)) {
    return { ok: true, inputPath, resolvedPath: inputPath, displayName, parentDir }
  }

  if (parentDir && parentDir !== inputPath && fs.existsSync(parentDir)) {
    const repaired = findLikelyFile(parentDir, inputPath)
    if (repaired) {
      return {
        ok: true,
        inputPath,
        resolvedPath: repaired,
        displayName: path.basename(repaired),
        parentDir,
        message: '已自动匹配到真实文件'
      }
    }

    return {
      ok: false,
      inputPath,
      resolvedPath: parentDir,
      displayName,
      parentDir,
      message: '文件不存在，但所在目录仍可打开'
    }
  }

  return {
    ok: false,
    inputPath,
    resolvedPath: '',
    displayName,
    parentDir,
    message: '文件或目录不存在，可能已被移动或删除'
  }
}

function findLikelyFile(parentDir: string, brokenPath: string): string {
  const ext = path.extname(brokenPath).toLowerCase()
  const brokenBase = stripBadChars(path.basename(brokenPath, ext)).toLowerCase()
  const mediaExts = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.m4a', '.mp3', '.aac', '.flac', '.wav', '.opus'])

  try {
    const allFiles = fs.readdirSync(parentDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(parentDir, entry.name))
      .filter(file => path.basename(file) !== '.gitkeep')

    const files = allFiles.filter(file => !ext || path.extname(file).toLowerCase() === ext)
    const candidates = files.length > 0
      ? files
      : allFiles.filter(file => mediaExts.has(path.extname(file).toLowerCase()))

    if (candidates.length === 1) return candidates[0]

    const exact = candidates.find(file => stripBadChars(path.basename(file, path.extname(file))).toLowerCase() === brokenBase)
    if (exact) return exact

    const scored = candidates
      .map(file => ({ file, score: scoreName(stripBadChars(path.basename(file, path.extname(file))).toLowerCase(), brokenBase) }))
      .sort((a, b) => b.score - a.score)

    if (scored[0]?.score > 0.35) return scored[0].file

    return candidates
      .map(file => ({ file, time: fs.statSync(file).mtimeMs }))
      .sort((a, b) => b.time - a.time)[0]?.file || ''
  } catch {
    return ''
  }
}

function stripBadChars(value: string): string {
  return value.replace(/\uFFFD/g, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

function scoreName(a: string, b: string): number {
  if (!a || !b) return 0
  if (a.includes(b) || b.includes(a)) return 1

  let common = 0
  const chars = new Set(a)
  for (const char of b) {
    if (chars.has(char)) common += 1
  }

  return common / Math.max(a.length, b.length)
}

export function registerIpcHandlers(
  win: BrowserWindow,
  ytDlp: YtDlpService,
  downloadManager: DownloadManager,
  ffmpeg: FfmpegService,
  history: HistoryService,
  settings: SettingsService,
  bilibili: BilibiliAuthService,
  savedUrls: SavedUrlsService
): void {
  ipcMain.handle(IpcChannels.YTDLP_PARSE_URL, async (_event, { url }: { url: string }) => {
    return ytDlp.parseVideo(url)
  })

  ipcMain.handle(IpcChannels.YTDLP_PARSE_PLAYLIST, async (_event, { url }: { url: string }) => {
    return ytDlp.parsePlaylist(url)
  })

  ipcMain.handle(IpcChannels.YTDLP_GET_VERSION, async () => {
    return ytDlp.getVersion()
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_START, async (_event, req: StartDownloadRequest) => {
    return downloadManager.startDownload(req, win)
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL, async (_event, { taskId }: { taskId: string }) => {
    return downloadManager.cancelDownload(taskId)
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_RECOVER, async () => {
    return downloadManager.recoverUnfinished()
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_PATH, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_FILE, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.DIALOG_OPEN_FILE, async (_event, { filepath }: { filepath: string }) => {
    const result = resolveExistingPath(filepath)
    if (!result.resolvedPath) return { ok: false, message: result.message }

    if (fs.existsSync(result.resolvedPath)) {
      const stat = fs.statSync(result.resolvedPath)
      if (stat.isDirectory()) {
        await shell.openPath(result.resolvedPath)
        return { ok: result.ok, message: result.message }
      }

      shell.showItemInFolder(result.resolvedPath)
      return { ok: result.ok, message: result.message }
    }

    return { ok: false, message: result.message }
  })

  ipcMain.handle(IpcChannels.PATH_RESOLVE, (_event, { filepath }: { filepath: string }) => {
    return resolveExistingPath(filepath)
  })

  ipcMain.handle(IpcChannels.FFMPEG_CONVERT, async (_event, req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }) => {
    return ffmpeg.convertVideo(
      req,
      data => win.webContents.send('ffmpeg:progress', data),
      data => win.webContents.send('ffmpeg:complete', data),
      data => win.webContents.send('ffmpeg:error', data)
    )
  })

  ipcMain.handle(IpcChannels.FFMPEG_EXTRACT_AUDIO, async (_event, req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }) => {
    return ffmpeg.extractAudio(
      req,
      data => win.webContents.send('ffmpeg:progress', data),
      data => win.webContents.send('ffmpeg:complete', data),
      data => win.webContents.send('ffmpeg:error', data)
    )
  })

  ipcMain.handle(IpcChannels.FILE_EXISTS, async (_event, { filepath }: { filepath: string }) => {
    if (!filepath) return { ok: false, message: '文件路径为空' }
    return { ok: fs.existsSync(filepath) }
  })

  ipcMain.handle(IpcChannels.FILE_DELETE, async (_event, { filepath }: { filepath: string }) => {
    if (!filepath) return { ok: false, message: '文件路径为空' }

    try {
      if (!fs.existsSync(filepath)) {
        return { ok: false, message: '文件不存在，可能已被移动或删除' }
      }

      fs.unlinkSync(filepath)
      const parentDir = path.dirname(filepath)
      if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
        fs.rmdirSync(parentDir)
      }

      return { ok: true }
    } catch (err: unknown) {
      logger.capture('file:delete failed', err, { filepath })
      return { ok: false, message: errorMessage(err, '删除失败') }
    }
  })

  ipcMain.handle(IpcChannels.FILE_SHOW_IN_FOLDER, async (_event, { filepath }: { filepath: string }) => {
    if (!filepath) return { ok: false, message: '文件路径为空' }

    try {
      const result = resolveExistingPath(filepath)
      if (!result.resolvedPath) return { ok: false, message: result.message }
      shell.showItemInFolder(result.resolvedPath)
      return { ok: true }
    } catch (err: unknown) {
      logger.capture('file:showInFolder failed', err, { filepath })
      return { ok: false, message: errorMessage(err, '无法打开文件所在位置') }
    }
  })

  ipcMain.handle(IpcChannels.HISTORY_LIST, () => history.getAll())
  ipcMain.handle(IpcChannels.HISTORY_ADD, (_event, entry: HistoryEntry) => history.add(entry))
  ipcMain.handle(IpcChannels.HISTORY_DELETE, (_event, { id }: { id: string }) => history.delete(id))
  ipcMain.handle(IpcChannels.HISTORY_CLEAR, () => history.clear())

  ipcMain.handle(IpcChannels.SAVED_URLS_LIST, () => savedUrls.getAll())
  ipcMain.handle(IpcChannels.SAVED_URLS_ADD, (_event, entry: { url: string; title: string; thumbnail: string; uploader: string }) => savedUrls.add(entry))
  ipcMain.handle(IpcChannels.SAVED_URLS_DELETE, (_event, { id }: { id: string }) => savedUrls.delete(id))
  ipcMain.handle(IpcChannels.SAVED_URLS_DELETE_BY_URL, (_event, { url }: { url: string }) => savedUrls.deleteByUrl(url))

  ipcMain.handle(IpcChannels.BILIBILI_GENERATE_QR, async () => bilibili.generateQrCode())
  ipcMain.handle(IpcChannels.BILIBILI_POLL_LOGIN, async (_event, { qrcode_key }: { qrcode_key: string }) => bilibili.pollLogin(qrcode_key))
  ipcMain.handle(IpcChannels.BILIBILI_GET_STATE, () => bilibili.getState())
  ipcMain.handle(IpcChannels.BILIBILI_CLEAR_COOKIES, () => bilibili.clearCookies())
  ipcMain.handle(IpcChannels.BILIBILI_CHECK_COOKIES, () => bilibili.isCookieExpired())

  ipcMain.handle(IpcChannels.SETTINGS_GET, () => settings.get())
  ipcMain.handle(IpcChannels.SETTINGS_UPDATE, (_event, patch) => {
    const updated = settings.update(patch)
    downloadManager.setMaxConcurrent(updated.concurrentDownloads)
    return updated
  })

  ipcMain.handle(IpcChannels.SETTINGS_TEST_PROXY, async (_event, { proxy }: { proxy: string }): Promise<ProxyTestResult> => {
    const targetUrl = 'https://example.com/'
    const trimmed = proxy.trim()
    const testSession = session.fromPartition(`proxy-test-${Date.now()}`)

    try {
      if (trimmed) {
        await testSession.setProxy({
          proxyRules: trimmed,
          proxyBypassRules: '<local>'
        })
      }

      const startedAt = Date.now()
      const status = await new Promise<{ ok: boolean; statusCode?: number; error?: Error }>(resolve => {
        const request = net.request({ url: targetUrl, session: testSession })
        request.setHeader('User-Agent', 'ClipPick/1.0')

        const timeout = setTimeout(() => {
          request.abort()
          resolve({ ok: false, error: new Error('连接超时') })
        }, 8000)

        request.on('response', response => {
          response.on('data', () => { })
          response.on('end', () => {
            clearTimeout(timeout)
            resolve({
              ok: response.statusCode >= 200 && response.statusCode < 400,
              statusCode: response.statusCode
            })
          })
        })

        request.on('error', error => {
          clearTimeout(timeout)
          resolve({ ok: false, error })
        })

        request.end()
      })

      if (status.ok) {
        return {
          ok: true,
          message: '连接成功',
          latencyMs: Date.now() - startedAt
        }
      }

      if (status.error) {
        return {
          ok: false,
          message: errorMessage(status.error, '连接失败')
        }
      }

      return {
        ok: false,
        message: `请求失败 (${status.statusCode ?? '未知状态'})`
      }
    } catch (err: unknown) {
      return {
        ok: false,
        message: errorMessage(err, '连接失败')
      }
    }
  })

  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IpcChannels.APP_OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
    shell.openExternal(url)
  })

  ipcMain.handle(IpcChannels.VERSION_CHECK, async (): Promise<VersionCheckResult> => {
    const [ytDlpVer, ffmpegVer] = await Promise.all([
      ytDlp.getVersion().catch(() => 'unknown'),
      ffmpeg.getVersion().catch(() => 'unknown')
    ])

    let ytDlpLatest = ytDlpVer
    let ffmpegLatest = ffmpegVer

    try {
      const ytDlpRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (ytDlpRes.ok) {
        const json = await ytDlpRes.json() as GithubRelease
        ytDlpLatest = (json.tag_name || '').replace(/^v/, '') || ytDlpVer
      }
    } catch {
      // offline or rate-limited
    }

    try {
      const ffmpegRes = await fetch('https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (ffmpegRes.ok) {
        const json = await ffmpegRes.json() as GithubRelease
        ffmpegLatest = (json.tag_name || '').replace(/^v/, '') || ffmpegVer
      }
    } catch {
      // offline or rate-limited
    }

    return {
      ytDlp: {
        current: ytDlpVer,
        latest: ytDlpLatest,
        outdated: ytDlpVer !== ytDlpLatest && ytDlpVer !== 'unknown'
      },
      ffmpeg: {
        current: ffmpegVer,
        latest: ffmpegLatest,
        outdated: ffmpegVer !== ffmpegLatest && ffmpegVer !== 'unknown'
      }
    }
  })

  ipcMain.handle(IpcChannels.TRANSLATE_SET_KEY, (_event, { profileId, key }: { profileId: string; key: string }) => {
    settings.setApiKey(profileId, key)
    return settings.get()
  })

  ipcMain.handle(IpcChannels.TRANSLATE_TEST, async (_event, req: TranslateTestRequest): Promise<TranslateTestResult> => {
    const endpoint = req.endpoint.trim() || 'https://api.deepseek.com'
    const model = req.model.trim() || 'deepseek-v4-pro'
    const apiKey = req.apiKey.trim()
    const proxy = settings.get().proxy || ''

    if (!apiKey) {
      return { ok: false, message: 'API Key 不能为空' }
    }

    const url = `${endpoint.replace(/\/$/, '')}/chat/completions`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          ...(endpoint.includes('api.deepseek.com') ? { thinking: { type: 'enabled' }, reasoning_effort: 'medium' } : {}),
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 401) {
          return { ok: false, message: 'API Key 无效' }
        }
        return { ok: false, message: `API 错误 (${res.status}): ${body.slice(0, 120)}` }
      }

      return { ok: true, message: '连接成功' }
    } catch (err: unknown) {
      return { ok: false, message: normalizeTranslateError(err, proxy).message }
    } finally {
      clearTimeout(timer)
    }
  })

  ipcMain.handle(IpcChannels.TRANSLATE, async (_event, { text, profileId }: TranslateRequest): Promise<TranslateResult> => {
    const allSettings = settings.get()
    const pid = profileId || allSettings.activeProfileId
    const profile = allSettings.translateProfiles.find(item => item.id === pid)
    const proxy = allSettings.proxy || ''

    if (!profile) {
      throw new Error('未找到翻译方案，请检查设置')
    }

    const apiKey = settings.getApiKey(pid)
    if (!apiKey) {
      throw new Error(`翻译方案“${profile.name}”未配置 API Key`)
    }

    const endpoint = profile.endpoint || 'https://api.deepseek.com'
    const model = profile.model || 'deepseek-v4-pro'
    const url = `${endpoint.replace(/\/$/, '')}/chat/completions`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          ...(endpoint.includes('api.deepseek.com') ? { thinking: { type: 'enabled' }, reasoning_effort: 'medium' } : {}),
          messages: [
            { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
            { role: 'user', content: `请翻译以下内容：\n${text}` }
          ],
          temperature: 0.3
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 401) throw new Error('API Key 无效，请检查设置')
        if (res.status === 402) throw new Error('账户余额不足')
        throw new Error(`API 错误 (${res.status}): ${body.slice(0, 200)}`)
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      const translatedText = data.choices?.[0]?.message?.content?.trim()
      if (!translatedText) {
        throw new Error('翻译结果为空')
      }

      return { translatedText }
    } catch (err: unknown) {
      throw normalizeTranslateError(err, proxy)
    } finally {
      clearTimeout(timer)
    }
  })
}





