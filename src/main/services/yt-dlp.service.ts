import { spawn } from 'child_process'
import { getBinaryPath } from '../utils/paths'
import type { VideoParseResult, VideoFormat } from '../../shared/types'

export class YtDlpService {
  private binaryPath: string

  constructor() {
    this.binaryPath = getBinaryPath('yt-dlp.exe')
  }

  async parseVideo(url: string): Promise<VideoParseResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, [
        '-J', '--no-download', '--no-playlist',
        '--no-check-certificates', url
      ])

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
            const raw = JSON.parse(stdout)
            resolve(this.transformVideoInfo(raw))
          } catch (e) {
            reject(new Error('解析返回数据失败'))
          }
        } else {
          const msg = this.parseError(stderr)
          reject(new Error(msg))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`))
      })
    })
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, ['--version'])
      let stdout = ''
      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout.trim())
        else reject(new Error(`yt-dlp exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  private transformVideoInfo(raw: any): VideoParseResult {
    return {
      id: raw.id ?? '',
      title: raw.title ?? '未知标题',
      thumbnail: raw.thumbnail ?? '',
      duration: raw.duration ?? 0,
      uploader: raw.uploader ?? raw.channel ?? '未知',
      uploaderUrl: raw.uploader_url ?? '',
      description: raw.description ?? '',
      webpageUrl: raw.webpage_url ?? '',
      formats: this.extractFormats(raw.formats ?? [])
    }
  }

  private extractFormats(rawFormats: any[]): VideoFormat[] {
    const seen = new Set<string>()

    return rawFormats
      .filter(f => (f.video_ext !== 'none' || f.audio_ext !== 'none'))
      .filter(f => f.format_note !== 'storyboard')
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
  }

  private parseError(stderr: string): string {
    if (stderr.includes('Unsupported URL')) return '不支持的链接'
    if (stderr.includes('Video unavailable')) return '视频不可用'
    if (stderr.includes('Private video')) return '私密视频，无法访问'
    if (stderr.includes('Sign in to confirm your age')) return '年龄限制，需要登录'
    if (stderr.includes('This video is not available')) return '视频不可用'
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
