import { getBinaryPath } from '../utils/paths'
import { spawnSafe } from '../utils/spawn-safe'
import type { VideoParseResult, VideoFormat } from '../../shared/types'
import { buildParseAttempts, extractUrl } from './yt-dlp-args'
import { SettingsService } from './settings.service'

export class YtDlpService {
  private binaryPath: string

  constructor(private settings: SettingsService) {
    this.binaryPath = getBinaryPath('yt-dlp.exe')
  }

  async parseVideo(url: string): Promise<VideoParseResult> {
    const cleanUrl = extractUrl(url)
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
            const result = this.transformVideoInfo(JSON.parse(stdout))
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

  private transformVideoInfo(raw: any): VideoParseResult {
    return {
      id: raw.id ?? '',
      title: raw.title ?? '未知标题',
      thumbnail: this.normalizeThumbnail(raw),
      duration: raw.duration ?? 0,
      uploader: raw.uploader ?? raw.channel ?? '未知',
      uploaderUrl: raw.uploader_url ?? '',
      description: raw.description ?? '',
      webpageUrl: raw.webpage_url ?? '',
      formats: this.extractFormats(raw.formats ?? [])
    }
  }

  private normalizeThumbnail(raw: any): string {
    const candidates = [
      raw.thumbnail,
      ...(Array.isArray(raw.thumbnails) ? raw.thumbnails.map((item: any) => item.url) : [])
    ].filter(Boolean)

    const url = candidates
      .map((item: string) => String(item).trim())
      .find((item: string) => item && !item.startsWith('data:'))

    if (!url) return ''
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
    return url
  }

  private extractFormats(rawFormats: any[]): VideoFormat[] {
    const seen = new Set<string>()
    const formats = rawFormats
      .filter(f => (f.video_ext !== 'none' || f.audio_ext !== 'none'))
      .filter(f => f.format_note !== 'storyboard')
      .filter(f => f.ext !== 'mhtml')
      .map(f => ({
        formatId: f.format_id ?? '',
        ext: f.ext ?? '',
        resolution: f.height ? `${f.width}x${f.height}` : 'audio only',
        filesize: f.filesize ?? f.filesize_approx ?? 0,
        filesizeText: this.formatBytes(f.filesize ?? f.filesize_approx ?? 0),
        videoCodec: f.vcodec ?? 'none',
        audioCodec: f.acodec ?? 'none',
        videoBitrate: f.vbr ?? 0,
        audioBitrate: f.abr ?? 0,
        fps: f.fps ?? 0,
        hasVideo: f.video_ext !== 'none',
        hasAudio: f.audio_ext !== 'none',
        height: f.height ?? 0,
        note: f.format_note ?? ''
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

  private parseError(stderr: string): string {
    if (stderr.includes('Could not copy Chrome cookie database')) {
      return '解析失败：无法读取浏览器 Cookie，请关闭浏览器或改用 cookies.txt'
    }
    if (stderr.includes('Please sign in') || stderr.includes('Sign in') || stderr.includes('login')) {
      return '解析失败：YouTube 要求登录。请使用 cookies.txt，或确认该视频在未登录窗口中也能播放'
    }
    if (stderr.includes('Only images are available') || stderr.includes('No downloadable formats')) {
      return '解析失败：YouTube 只返回了缩略图格式。通常需要 cookies.txt，或安装 Deno/Node 22+ 作为 JS Runtime'
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
