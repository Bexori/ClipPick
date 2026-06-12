import { getBinaryPath } from '../utils/paths'
import { spawnSafe } from '../utils/spawn-safe'
import type { VideoParseResult, VideoFormat, SubtitleInfo, PlaylistParseResult, PlaylistEntry } from '../../shared/types'
import { buildParseAttempts, extractUrl, buildCommonArgsForUrl } from './yt-dlp-args'
import { SettingsService } from './settings.service'
import * as https from 'https'
import * as http from 'http'

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'

interface RawThumbnail {
  url?: unknown
}

interface RawFormat {
  format_id?: unknown
  ext?: unknown
  width?: unknown
  height?: unknown
  filesize?: unknown
  filesize_approx?: unknown
  vcodec?: unknown
  acodec?: unknown
  vbr?: unknown
  abr?: unknown
  fps?: unknown
  video_ext?: unknown
  audio_ext?: unknown
  format_note?: unknown
}

interface RawVideoInfo {
  id?: unknown
  title?: unknown
  thumbnail?: unknown
  thumbnails?: unknown
  duration?: unknown
  uploader?: unknown
  channel?: unknown
  uploader_url?: unknown
  description?: unknown
  webpage_url?: unknown
  formats?: unknown
  subtitles?: unknown
  automatic_captions?: unknown
}

function resolveShortLink(url: string, maxHops = 5): Promise<string> {
  return new Promise((resolve) => {
    let hops = 0
    let currentUrl = url

    function follow() {
      if (hops >= maxHops) { resolve(currentUrl); return }

      const client = currentUrl.startsWith('https:') ? https : http
      const req = client.get(currentUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': MOBILE_UA,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          hops++
          currentUrl = new URL(res.headers.location, currentUrl).href
          res.destroy()
          follow()
        } else {
          res.destroy()
          resolve(currentUrl)
        }
      })
      req.on('error', () => resolve(currentUrl))
      req.on('timeout', () => { req.destroy(); resolve(currentUrl) })
    }

    follow()
  })
}

// yt-dlp natively handles short-link resolution — do not resolve manually
const SHORT_LINK_HOSTS: string[] = []

function needsResolve(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export class YtDlpService {
  private binaryPath: string

  constructor(private settings: SettingsService) {
    this.binaryPath = getBinaryPath('yt-dlp.exe')
  }

  async parseVideo(url: string): Promise<VideoParseResult> {
    let cleanUrl = extractUrl(url)
    if (needsResolve(cleanUrl)) {
      cleanUrl = await resolveShortLink(cleanUrl)
    }
    const attempts = buildParseAttempts(cleanUrl, this.settings.get())
    let lastError = ''

    for (const attempt of attempts) {
      try {
        return await this.runParseAttempt(attempt.args)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    throw new Error(this.parseError(lastError))
  }

  async parsePlaylist(url: string): Promise<PlaylistParseResult> {
    const cleanUrl = extractUrl(url)
    const common = buildCommonArgsForUrl(cleanUrl, this.settings.get())
    const isBili = isBilibiliHost(cleanUrl)

    // YouTube supports --flat-playlist well; Bilibili needs full extraction for titles/thumbnails
    const baseArgs = isBili
      ? ['-J', '--no-download', '--playlist-end', '30', ...common, cleanUrl]
      : ['-J', '--no-download', '--flat-playlist', '--playlist-end', '50', ...common, cleanUrl]

    const timeoutMs = isBili ? 120000 : 60000

    return new Promise((resolve, reject) => {
      const proc = spawnSafe(this.binaryPath, baseArgs)
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('解析播放列表超时'))
      }, timeoutMs)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 && stdout) {
          try {
            const raw = JSON.parse(stdout)
            resolve(this.transformPlaylist(raw, cleanUrl))
          } catch (err) {
            reject(new Error('解析播放列表数据失败'))
          }
        } else {
          reject(new Error(stderr || '解析播放列表失败'))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`))
      })
    })
  }

  private transformPlaylist(raw: Record<string, unknown>, sourceUrl: string): PlaylistParseResult {
    const entries: PlaylistEntry[] = []
    const rawEntries = Array.isArray(raw.entries) ? raw.entries : []

    for (let i = 0; i < rawEntries.length; i++) {
      const entry = toRecord(rawEntries[i])
      const id = stringValue(entry.id) || stringValue(entry.display_id)
      if (!id) continue
      entries.push({
        id,
        title: stringValue(entry.title) || stringValue(entry.fulltitle) || '未知标题',
        url: stringValue(entry.webpage_url) || stringValue(entry.url) || `${sourceUrl}&v=${id}`,
        duration: numberValue(entry.duration),
        thumbnail: pickThumbnail(entry),
        uploader: stringValue(entry.uploader) || stringValue(entry.channel) || '',
        index: i + 1
      })
    }

    return {
      id: stringValue(raw.id),
      title: stringValue(raw.title) || stringValue(raw.playlist_title) || '播放列表',
      uploader: stringValue(raw.uploader) || stringValue(raw.channel) || '',
      entryCount: entries.length,
      entries
    }
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawnSafe(this.binaryPath, ['--version'])
      let stdout = ''

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout.trim())
        else reject(new Error(`yt-dlp exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  private async runParseAttempt(args: string[]): Promise<VideoParseResult> {
    return new Promise((resolve, reject) => {
      const proc = spawnSafe(this.binaryPath, args)
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('解析超时'))
      }, 30000)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 && stdout) {
          try {
            const result = this.transformVideoInfo(JSON.parse(stdout) as unknown)
            if (result.formats.length === 0) {
              reject(new Error(`${stderr}\nNo downloadable formats after filtering.`))
              return
            }
            resolve(result)
          } catch (error) {
            reject(error instanceof Error ? error : new Error('解析返回数据失败'))
          }
        } else {
          reject(new Error(stderr))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`))
      })
    })
  }

  private transformVideoInfo(rawValue: unknown): VideoParseResult {
    const raw = toRawVideoInfo(rawValue)
    return {
      id: stringValue(raw.id),
      title: stringValue(raw.title) || '未知标题',
      thumbnail: this.normalizeThumbnail(raw),
      duration: numberValue(raw.duration),
      uploader: stringValue(raw.uploader) || stringValue(raw.channel) || '未知',
      uploaderUrl: stringValue(raw.uploader_url),
      description: stringValue(raw.description),
      webpageUrl: stringValue(raw.webpage_url),
      formats: this.extractFormats(Array.isArray(raw.formats) ? raw.formats : []),
      subtitles: this.extractSubtitles(raw)
    }
  }

  private normalizeThumbnail(raw: RawVideoInfo): string {
    const candidates = [
      raw.thumbnail,
      ...(Array.isArray(raw.thumbnails) ? raw.thumbnails.map((item) => toRawThumbnail(item).url) : [])
    ].filter(Boolean)

    const url = candidates
      .map((item: string) => String(item).trim())
      .find((item: string) => item && !item.startsWith('data:'))

    if (!url) return ''
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
    return url
  }

  private extractFormats(rawFormats: unknown[]): VideoFormat[] {
    const seen = new Set<string>()
    const formats = rawFormats
      .map(toRawFormat)
      .filter(f => (f.video_ext !== 'none' || f.audio_ext !== 'none'))
      .filter(f => f.format_note !== 'storyboard')
      .filter(f => f.ext !== 'mhtml')
      .map(f => ({
        formatId: stringValue(f.format_id),
        ext: stringValue(f.ext),
        resolution: numberValue(f.height) ? `${numberValue(f.width)}x${numberValue(f.height)}` : 'audio only',
        filesize: numberValue(f.filesize) || numberValue(f.filesize_approx),
        filesizeText: this.formatBytes(numberValue(f.filesize) || numberValue(f.filesize_approx)),
        videoCodec: stringValue(f.vcodec) || 'none',
        audioCodec: stringValue(f.acodec) || 'none',
        videoBitrate: numberValue(f.vbr),
        audioBitrate: numberValue(f.abr),
        fps: numberValue(f.fps),
        hasVideo: f.video_ext !== 'none',
        hasAudio: f.audio_ext !== 'none',
        height: numberValue(f.height),
        note: stringValue(f.format_note)
      }))
      .filter(f => {
        const key = `${f.formatId}|${f.ext}|${f.height}|${f.filesize}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => b.height - a.height || b.filesize - a.filesize)

    const mergedFormats = formats
      .filter(f => f.hasVideo && !f.hasAudio)
      .map(f => ({
        ...f,
        formatId: `${f.formatId}+bestaudio/best`,
        hasAudio: true,
        audioCodec: 'best',
        note: f.note ? `${f.note} + audio` : 'video + audio'
      }))

    return [...mergedFormats, ...formats]
  }

  private extractSubtitles(raw: RawVideoInfo): SubtitleInfo[] {
    const langNames = new Intl.DisplayNames(['zh-CN', 'en'], { type: 'language', fallback: 'code' })
    const result: SubtitleInfo[] = []
    const seen = new Set<string>()

    function collect(obj: unknown, kind: 'manual' | 'auto') {
      if (!obj || typeof obj !== 'object') return
      for (const lang of Object.keys(obj as Record<string, unknown>)) {
        const key = `${kind}:${lang}`
        if (seen.has(key)) continue
        seen.add(key)
        try {
          result.push({ lang, label: langNames.of(lang) ?? lang, kind })
        } catch {
          result.push({ lang, label: lang, kind })
        }
      }
    }

    collect(raw.subtitles, 'manual')
    collect(raw.automatic_captions, 'auto')
    return result
  }

  private parseError(stderr: string): string {
    if (stderr.includes('Could not copy Chrome cookie database')) {
      return '解析失败：无法读取浏览器 Cookie，请关闭浏览器或改用 cookies.txt'
    }
    if (stderr.includes('Please sign in') || stderr.includes('Sign in') || stderr.includes('login')) {
      return '解析失败：YouTube 要求登录。请使用 cookies.txt，或确认该视频在未登录窗口中也能播放'
    }
    if (stderr.includes('Only images are available') || stderr.includes('No downloadable formats')) {
      return '解析失败：该页面未检测到可下载的视频格式，可能是列表/合集页，或需要提供 Cookie'
    }
    if (stderr.includes('n challenge solving failed') || stderr.includes('No supported JavaScript runtime')) {
      return '解析失败：YouTube 挑战解析失败。建议安装 Deno 或 Node 22+，并在后续设置里指定 JS Runtime'
    }
    if (stderr.includes('PO Token')) {
      return '解析失败：YouTube 当前需要 PO Token 或登录 Cookie，建议使用 cookies.txt'
    }
    if (stderr.includes('DRM protected')) return '解析失败：该视频受 DRM 保护，无法下载'
    if (stderr.includes('Unsupported URL')) return '不支持的链接'
    if (stderr.includes('Private video')) return '私密视频，无法访问'
    if (stderr.includes('HTTP Error 403') || stderr.includes('Forbidden')) {
      return '解析失败：访问被拒绝，请检查 Cookie 或代理'
    }
    if (stderr.includes('Video unavailable') || stderr.includes('This video is not available')) {
      return '视频不可用，或当前网络/Cookie 状态无法访问'
    }
    if (stderr.includes('抖音') || stderr.includes('douyin') || stderr.includes('aweme')) {
      if (stderr.includes('blocked') || stderr.includes('captcha') || stderr.includes('verify') || stderr.includes('challenge')) {
        return '抖音访问受限（风控/验证码拦截），可尝试在设置中配置代理，或提供 cookies.txt'
      }
      if (stderr.includes('private') || stderr.includes('deleted') || stderr.includes('removed')) {
        return '该抖音视频为私密或已被删除'
      }
      if (stderr.includes('not found') || stderr.includes('404') || stderr.includes('does not exist')) {
        return '抖音视频不存在或链接已失效'
      }
      return '抖音解析失败：可能是风控限制。可尝试使用代理，或将抖音 cookies.txt 放入 userData 目录'
    }
    return stderr.slice(0, 200) || '解析失败'
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '未知大小'
    const units = ['B', 'KiB', 'MiB', 'GiB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
    return `${size.toFixed(2)} ${units[i]}`
  }
}

function isBilibiliHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.includes('bilibili.com') || hostname === 'b23.tv'
  } catch {
    return false
  }
}

function pickThumbnail(raw: Record<string, unknown>): string {
  const candidates: string[] = []
  if (typeof raw.thumbnail === 'string') candidates.push(raw.thumbnail)
  const thumbs = raw.thumbnails
  if (Array.isArray(thumbs)) {
    for (const t of thumbs) {
      if (t && typeof t === 'object' && typeof (t as Record<string, unknown>).url === 'string') {
        candidates.push((t as Record<string, unknown>).url as string)
      }
    }
  }
  const url = candidates.find(u => u && !u.startsWith('data:'))
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
  return url
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function toRawVideoInfo(value: unknown): RawVideoInfo {
  return toRecord(value)
}

function toRawThumbnail(value: unknown): RawThumbnail {
  return toRecord(value)
}

function toRawFormat(value: unknown): RawFormat {
  return toRecord(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}
