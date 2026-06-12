import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IpcChannels } from '../../shared/types'
import type { StartDownloadRequest, HistoryEntry, ProgressPayload, CompletePayload, ErrorPayload, TranslateRequest, TranslateResult, VersionCheckResult } from '../../shared/types'
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

function resolveExistingPath(filepath: string) {
  const inputPath = filepath.trim()
  const parentDir = inputPath ? path.dirname(inputPath) : ''
  const displayName = inputPath ? path.basename(inputPath) : ''

  if (!inputPath) {
    return { ok: false, inputPath, resolvedPath: '', displayName: '', parentDir: '', message: '路径为空' }
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
        message: '已自动匹配到真实文件，可正常处理'
      }
    }

    return {
      ok: false,
      inputPath,
      resolvedPath: parentDir,
      displayName,
      parentDir,
      message: '文件不存在，但所在目录可打开'
    }
  }

  return { ok: false, inputPath, resolvedPath: '', displayName, parentDir, message: '文件或目录不存在，可能已被移动或删除' }
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
  // ========== yt-dlp ==========
  ipcMain.handle(IpcChannels.YTDLP_PARSE_URL, async (_event, { url }: { url: string }) => {
    return await ytDlp.parseVideo(url)
  })

  ipcMain.handle(IpcChannels.YTDLP_PARSE_PLAYLIST, async (_event, { url }: { url: string }) => {
    return await ytDlp.parsePlaylist(url)
  })

  ipcMain.handle(IpcChannels.YTDLP_GET_VERSION, async () => {
    return await ytDlp.getVersion()
  })

  // ========== Download ==========
  ipcMain.handle(IpcChannels.DOWNLOAD_START, async (_event, req: StartDownloadRequest) => {
    return downloadManager.startDownload(req, win)
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL, async (_event, { taskId }: { taskId: string }) => {
    return downloadManager.cancelDownload(taskId)
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_RECOVER, async () => {
    return downloadManager.recoverUnfinished()
  })

  // ========== Dialog ==========
  ipcMain.handle(IpcChannels.DIALOG_SELECT_PATH, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
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

  // ========== FFmpeg ==========
  ipcMain.handle(IpcChannels.FFMPEG_CONVERT, async (_event, req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }) => {
    return ffmpeg.convertVideo(
      req,
      (data) => win.webContents.send('ffmpeg:progress', data),
      (data) => win.webContents.send('ffmpeg:complete', data),
      (data) => win.webContents.send('ffmpeg:error', data)
    )
  })

  ipcMain.handle(IpcChannels.FFMPEG_EXTRACT_AUDIO, async (_event, req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }) => {
    return ffmpeg.extractAudio(
      req,
      (data) => win.webContents.send('ffmpeg:progress', data),
      (data) => win.webContents.send('ffmpeg:complete', data),
      (data) => win.webContents.send('ffmpeg:error', data)
    )
  })

  // ========== File ==========
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
      // also try removing the parent directory if empty
      const parent = path.dirname(filepath)
      if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
        fs.rmdirSync(parent)
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

  // ========== History ==========
  ipcMain.handle(IpcChannels.HISTORY_LIST, () => {
    return history.getAll()
  })

  ipcMain.handle(IpcChannels.HISTORY_ADD, (_event, entry: HistoryEntry) => {
    history.add(entry)
  })

  ipcMain.handle(IpcChannels.HISTORY_DELETE, (_event, { id }: { id: string }) => {
    history.delete(id)
  })

  ipcMain.handle(IpcChannels.HISTORY_CLEAR, () => {
    history.clear()
  })

  // ========== Saved URLs ==========
  ipcMain.handle(IpcChannels.SAVED_URLS_LIST, () => {
    return savedUrls.getAll()
  })

  ipcMain.handle(IpcChannels.SAVED_URLS_ADD, (_event, entry: { url: string; title: string; thumbnail: string; uploader: string }) => {
    return savedUrls.add(entry)
  })

  ipcMain.handle(IpcChannels.SAVED_URLS_DELETE, (_event, { id }: { id: string }) => {
    savedUrls.delete(id)
  })

  // ========== Bilibili ==========
  ipcMain.handle(IpcChannels.BILIBILI_GENERATE_QR, async () => {
    return await bilibili.generateQrCode()
  })

  ipcMain.handle(IpcChannels.BILIBILI_POLL_LOGIN, async (_event, { qrcode_key }: { qrcode_key: string }) => {
    return await bilibili.pollLogin(qrcode_key)
  })

  ipcMain.handle(IpcChannels.BILIBILI_GET_STATE, () => {
    return bilibili.getState()
  })

  ipcMain.handle(IpcChannels.BILIBILI_CLEAR_COOKIES, () => {
    bilibili.clearCookies()
  })

  ipcMain.handle(IpcChannels.BILIBILI_CHECK_COOKIES, () => {
    return bilibili.isCookieExpired()
  })

  // ========== Settings ==========
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => {
    return settings.get()
  })

  ipcMain.handle(IpcChannels.SETTINGS_UPDATE, (_event, patch) => {
    const updated = settings.update(patch)
    downloadManager.setMaxConcurrent(updated.concurrentDownloads)
    return updated
  })

  // ========== App ==========
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IpcChannels.APP_OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
    shell.openExternal(url)
  })

  // ========== Version Check ==========
  ipcMain.handle(IpcChannels.VERSION_CHECK, async (): Promise<VersionCheckResult> => {
    const [ytDlpVer, ffmpegVer] = await Promise.all([
      ytDlp.getVersion().catch(() => 'unknown'),
      ffmpeg.getVersion().catch(() => 'unknown')
    ])

    // Fetch latest versions from GitHub
    let ytDlpLatest = ytDlpVer
    let ffmpegLatest = ffmpegVer

    try {
      const ytDlpRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: { 'Accept': 'application/vnd.github+json' }
      })
      if (ytDlpRes.ok) {
        const json = await ytDlpRes.json() as GithubRelease
        ytDlpLatest = (json.tag_name || '').replace(/^v/, '') || ytDlpVer
      }
    } catch { /* offline or rate-limited */ }

    try {
      const ffmpegRes = await fetch('https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest', {
        headers: { 'Accept': 'application/vnd.github+json' }
      })
      if (ffmpegRes.ok) {
        const json = await ffmpegRes.json() as GithubRelease
        ffmpegLatest = (json.tag_name || '').replace(/^v/, '') || ffmpegVer
      }
    } catch { /* offline or rate-limited */ }

    return {
      ytDlp: { current: ytDlpVer, latest: ytDlpLatest, outdated: ytDlpVer !== ytDlpLatest && ytDlpVer !== 'unknown' },
      ffmpeg: { current: ffmpegVer, latest: ffmpegLatest, outdated: ffmpegVer !== ffmpegLatest && ffmpegVer !== 'unknown' }
    }
  })

  // ========== Translation ==========
  ipcMain.handle(IpcChannels.TRANSLATE_SET_KEY, (_event, { profileId, key }: { profileId: string; key: string }) => {
    settings.setApiKey(profileId, key)
    return settings.get()
  })

  ipcMain.handle(IpcChannels.TRANSLATE, async (_event, { text, profileId }: TranslateRequest): Promise<TranslateResult> => {
    const allSettings = settings.get()
    const pid = profileId || allSettings.activeProfileId
    const profile = allSettings.translateProfiles.find(p => p.id === pid)
    if (!profile) throw new Error('未找到翻译方案，请检查设置')

    const apiKey = settings.getApiKey(pid)
    if (!apiKey) throw new Error(`翻译方案 "${profile.name}" 未配置 API Key`)

    const endpoint = profile.endpoint || 'https://api.deepseek.com/v1'
    const model = profile.model || 'deepseek-chat'
    const url = `${endpoint.replace(/\/$/, '')}/chat/completions`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: [
                '你是一名专业的视频内容中文翻译助手，擅长翻译视频标题、视频简介、字幕文本、短视频文案、口语对白和平台分享内容。',
                '请将用户提供的内容翻译为自然、准确、符合中文表达习惯的简体中文。翻译时应结合上下文、语气、说话场景和视频内容类型，不要逐字硬译，不要机翻腔。对于口语、网络用语、日语对白、英文标题、影视/动漫/游戏相关内容，应在保留原意的基础上转换为中文用户容易理解的表达。',
                '',
                '翻译规则：',
                '1. 如果原文已经是中文，直接返回原文。',
                '2. 只输出翻译后的中文内容，不要添加解释、说明、注释或额外内容。',
                '3. 保留原文的换行、时间轴、字幕序号、标点结构和基本排版。',
                '4. 保留链接、文件名、代码、命令、参数、数字、单位、时间、标签符号，不要随意改动。',
                '5. 人名、地名、品牌名、作品名、角色名等专有名词，已有通用中文译名的使用通用译名；没有通用译名的保留原文或采用自然音译。',
                '6. 视频标题要翻译得简洁自然，适合中文用户阅读，但不能标题党，不能改变原意。',
                '7. 视频简介要保持信息完整，语句通顺，不要删减关键信息。',
                '8. 字幕内容要符合中文口语习惯，句子可以适度调整，但不能改变人物语气、情绪和含义。',
                '9. 网络热词、梗、俚语应结合语境翻译，不要生硬直译。',
                '10. 对不确定的专有名词或特殊表达，优先保留原文，不要自行编造。',
                '11. 如果用户提供了术语表或固定翻译规则，必须优先遵守术语表。',
                '12. 不要输出"翻译如下""这是中文翻译"等任何提示语。'
              ].join('\n')
            },
            { role: 'user', content: `用户提供的文本如下：\n${text}` }
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
      if (!translatedText) throw new Error('翻译返回为空')

      return { translatedText }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('翻译请求超时，请检查网络')
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  })
}
