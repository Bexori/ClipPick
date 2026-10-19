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
  thumbnail_url?: unknown
  cover?: unknown
  poster?: unknown
  image?: unknown
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

const SHORT_LINK_HOSTS = [
  'v.douyin.com',
  'www.iesdouyin.com',
  'iesdouyin.com',
  'v.iesdouyin.com',
  'vm.tiktok.com',
  'vt.tiktok.com'
]

function needsResolve(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.includes(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

function normalizeSupportedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    if (hostname.includes('iesdouyin.com')) {
      const shareVideoMatch = parsed.pathname.match(/\/share\/video\/(\d+)/)
      if (shareVideoMatch?.[1]) {
        return `https://www.douyin.com/video/${shareVideoMatch[1]}`
      }
    }

    return url
  } catch {
    return url
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
    cleanUrl = normalizeSupportedUrl(cleanUrl)
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
    let cleanUrl = extractUrl(url)
    if (needsResolve(cleanUrl)) {
      cleanUrl = await resolveShortLink(cleanUrl)
    }
    cleanUrl = normalizeSupportedUrl(cleanUrl)
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

      proc.stdout!.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr!.on('data', (data: Buffer) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('瑙ｆ瀽鎾斁鍒楄〃瓒呮椂'))
      }, timeoutMs)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 && stdout) {
          try {
            const raw = JSON.parse(stdout)
            resolve(this.transformPlaylist(raw, cleanUrl))
          } catch (err) {
            reject(new Error('瑙ｆ瀽鎾斁鍒楄〃鏁版嵁澶辫触'))
          }
        } else {
          reject(new Error(stderr || '瑙ｆ瀽鎾斁鍒楄〃澶辫触'))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`鍚姩 yt-dlp 澶辫触: ${err.message}`))
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
        title: stringValue(entry.title) || stringValue(entry.fulltitle) || '鏈煡鏍囬',
        url: stringValue(entry.webpage_url) || stringValue(entry.url) || `${sourceUrl}&v=${id}`,
        duration: numberValue(entry.duration),
        thumbnail: pickThumbnail(entry),
        uploader: stringValue(entry.uploader) || stringValue(entry.channel) || '',
        index: i + 1
      })
    }

    return {
      id: stringValue(raw.id),
      title: stringValue(raw.title) || stringValue(raw.playlist_title) || '鎾斁鍒楄〃',
      uploader: stringValue(raw.uploader) || stringValue(raw.channel) || '',
      entryCount: entries.length,
      entries
    }
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawnSafe(this.binaryPath, ['--version'])
      let stdout = ''

      proc.stdout!.on('data', (data: Buffer) => { stdout += data.toString() })
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

      proc.stdout!.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr!.on('data', (data: Buffer) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('瑙ｆ瀽瓒呮椂'))
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
            reject(error instanceof Error ? error : new Error('瑙ｆ瀽杩斿洖鏁版嵁澶辫触'))
          }
        } else {
          reject(new Error(stderr))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`鍚姩 yt-dlp 澶辫触: ${err.message}`))
      })
    })
  }

  private transformVideoInfo(rawValue: unknown): VideoParseResult {
    const raw = toRawVideoInfo(rawValue)
    return {
      id: stringValue(raw.id),
      title: stringValue(raw.title) || '鏈煡鏍囬',
      thumbnail: this.normalizeThumbnail(raw),
      duration: numberValue(raw.duration),
      uploader: stringValue(raw.uploader) || stringValue(raw.channel) || '鏈煡',
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
      raw['thumbnail_url'],
      raw['cover'],
      raw['poster'],
      raw['image'],
      ...(Array.isArray(raw.thumbnails) ? raw.thumbnails.map((item) => thumbnailCandidate(item)) : [])
    ].filter(Boolean)

    const url = candidates
      .map(item => String(item).trim())
      .find(item => item && !item.startsWith('data:'))

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
      for (const [lang, tracks] of Object.entries(obj as Record<string, unknown>)) {
        const normalizedTracks = normalizeSubtitleTracks(tracks)
        if (normalizedTracks.length === 0) continue
        const key = `${kind}:${lang}`
        if (seen.has(key)) continue
        seen.add(key)
        const embeddable = normalizedTracks.some(track => isEmbeddableSubtitleExt(track.ext))
        try {
          result.push({ lang, label: langNames.of(lang) ?? lang, kind, embeddable })
        } catch {
          result.push({ lang, label: lang, kind, embeddable })
        }
      }
    }

    collect(raw.subtitles, 'manual')
    collect(raw.automatic_captions, 'auto')
    return result
  }

  private parseError(stderr: string): string {
    const normalized = stderr.toLowerCase()

    if (normalized.includes('could not copy chrome cookie database')) {
      return '无法读取浏览器 Cookie，请关闭占用浏览器后重试，或改用 cookies.txt。'
    }
    if (normalized.includes('please sign in') || normalized.includes('sign in') || normalized.includes('login')) {
      return '当前资源需要登录后才能访问，请补充有效 Cookie 或导入 cookies.txt。'
    }
    if (normalized.includes('only images are available') || normalized.includes('no downloadable formats')) {
      return '当前链接没有可下载的视频格式，可能只有图片、预览流，或需要登录后才能获取完整格式。'
    }
    if (normalized.includes('n challenge solving failed') || normalized.includes('no supported javascript runtime')) {
      return '当前站点需要 JavaScript 运行环境辅助解析，请确认 Deno 或 Node 22+ 可用。'
    }
    if (normalized.includes('po token')) {
      return '当前资源需要更完整的身份凭证，建议补充最新 Cookie 或导入 cookies.txt。'
    }
    if (normalized.includes('drm protected')) return '该资源受到 DRM 保护，当前无法直接下载。'
    if (normalized.includes('unsupported url')) return '当前链接暂不支持，请尝试分享页原链接或完整视频页链接。'
    if (normalized.includes('private video')) return '该视频为私密资源，当前无法访问。'
    if (normalized.includes('http error 403') || normalized.includes('forbidden')) {
      return '请求被目标站点拒绝，通常需要新的 Cookie、代理，或稍后重试。'
    }
    if (normalized.includes('video unavailable') || normalized.includes('this video is not available')) {
      return '该视频暂时不可用，可能已下架、地区受限，或需要登录后访问。'
    }
    if (normalized.includes('douyin') || normalized.includes('aweme') || normalized.includes('iesdouyin')) {
      if (normalized.includes('fresh cookies')) {
        return '抖音当前要求新鲜 Cookie。请在设置里选择浏览器 Cookie，或导入刚导出的 cookies.txt 后重试。'
      }
      if (normalized.includes('failed to parse json')) {
        return '抖音返回了异常数据，通常是未带上有效 Cookie 或触发了风控。请补充新鲜 Cookie 后再试。'
      }
      if (normalized.includes('blocked') || normalized.includes('captcha') || normalized.includes('verify') || normalized.includes('challenge')) {
        return '抖音触发了风控校验，请稍后再试，或补充浏览器 Cookie / cookies.txt。'
      }
      if (normalized.includes('private') || normalized.includes('deleted') || normalized.includes('removed')) {
        return '该抖音资源已被删除、设为私密，或当前账号无权访问。'
      }
      if (normalized.includes('not found') || normalized.includes('404') || normalized.includes('does not exist')) {
        return '抖音链接不存在，或短链展开后未找到有效视频页面。'
      }
      return '抖音链接解析失败，建议使用完整分享链接，并补充浏览器 Cookie 或 cookies.txt。'
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
  const directKeys = ['thumbnail', 'thumbnail_url', 'cover', 'poster', 'image']

  for (const key of directKeys) {
    const value = raw[key]
    if (typeof value === 'string') candidates.push(value)
  }

  const thumbs = raw.thumbnails
  if (Array.isArray(thumbs)) {
    for (const t of thumbs) {
      candidates.push(thumbnailCandidate(t))
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
function thumbnailCandidate(value: unknown): string {
  const record = toRecord(value)
  const keys = ['url', 'thumbnail', 'thumbnail_url', 'cover', 'poster', 'image']

  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return ''
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

function normalizeSubtitleTracks(value: unknown): Array<{ ext: string; url: string }> {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => toRecord(item))
    .map((track) => ({
      ext: typeof track.ext === 'string' ? track.ext.trim().toLowerCase() : '',
      url: typeof track.url === 'string' ? track.url.trim() : ''
    }))
    .filter(track => Boolean(track.url))
}

function isEmbeddableSubtitleExt(ext: string): boolean {
  return ['srt', 'ass', 'ssa', 'vtt', 'lrc', 'ttml'].includes(ext)
}
