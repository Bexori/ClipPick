import { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getBinaryPath, getFfmpegPath } from '../utils/paths'
import { spawnSafe } from '../utils/spawn-safe'
import type { StartDownloadRequest, ProgressPayload, CompletePayload, ErrorPayload } from '../../shared/types'
import { buildDownloadArgs } from './yt-dlp-args'
import { SettingsService } from './settings.service'

interface ManagedDownload {
  taskId: string
  process: ChildProcess | null
  status: string
  progress: number
  speed: string
  eta: string
  downloadedBytes: number
  totalBytes: number
  outputPath: string
  destLine: string
}

interface QueuedDownload {
  taskId: string
  req: StartDownloadRequest
}

export class DownloadManager {
  private downloads = new Map<string, ManagedDownload>()
  private queue: QueuedDownload[] = []
  private ytDlpPath: string
  private ffmpegPath: string
  private maxConcurrent: number

  constructor(private settings: SettingsService) {
    this.ytDlpPath = getBinaryPath('yt-dlp.exe')
    this.ffmpegPath = getFfmpegPath()
    this.maxConcurrent = settings.get().concurrentDownloads
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, Math.min(8, Math.round(n)))
  }

  startDownload(req: StartDownloadRequest, win: BrowserWindow): string {
    if (!req.url.trim()) {
      const taskId = randomUUID()
      win.webContents.send('download:error', {
        taskId,
        error: '下载失败：视频链接为空',
        detail: 'StartDownloadRequest.url is empty.'
      } as ErrorPayload)
      return taskId
    }

    const taskId = randomUUID()
    const managed: ManagedDownload = {
      taskId,
      process: null,
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      downloadedBytes: 0,
      totalBytes: 0,
      outputPath: '',
      destLine: ''
    }

    this.downloads.set(taskId, managed)

    if (this.getActiveCount() >= this.maxConcurrent) {
      this.queue.push({ taskId, req })
      return taskId
    }

    this.startDownloadInternal(taskId, req, win)
    return taskId
  }

  cancelDownload(taskId: string): boolean {
    const dl = this.downloads.get(taskId)
    if (!dl) return false

    if (dl.status === 'queued') {
      dl.status = 'cancelled'
      this.queue = this.queue.filter(item => item.taskId !== taskId)
      this.downloads.delete(taskId)
      return true
    }

    dl.status = 'cancelled'
    dl.process?.kill('SIGTERM')
    return true
  }

  private startDownloadInternal(taskId: string, req: StartDownloadRequest, win: BrowserWindow): void {
    const managed = this.downloads.get(taskId)
    if (!managed) return

    const filename = this.sanitizeFilename(req.filename)
    const outputTemplate = `${req.outputDir}\\${filename}.%(ext)s`
    const args = buildDownloadArgs(req.url, req.formatId, outputTemplate, this.ffmpegPath, this.settings.get())
    const proc = spawnSafe(this.ytDlpPath, args)
    const output = { stderr: '' }

    Object.assign(managed, {
      process: proc,
      status: 'downloading',
      outputPath: outputTemplate
    })

    this.parseOutput(proc, managed, win, output)

    proc.on('close', (code) => {
      if (code === 0 || managed.progress >= 100) {
        managed.status = 'completed'
        managed.progress = 100
        const finalPath = this.resolveDownloadedPath(req.outputDir, filename, managed.destLine, managed.outputPath)
        win.webContents.send('download:complete', {
          taskId,
          filepath: finalPath,
          filesize: managed.totalBytes
        } as CompletePayload)
      } else if (managed.status !== 'cancelled') {
        managed.status = 'error'
        const detail = output.stderr.trim()
        win.webContents.send('download:error', {
          taskId,
          error: this.formatDownloadError(detail, code),
          detail
        } as ErrorPayload)
      }

      setTimeout(() => {
        this.downloads.delete(taskId)
        this.processQueue(win)
      }, 1000)
    })

    proc.on('error', (err) => {
      managed.status = 'error'
      win.webContents.send('download:error', {
        taskId,
        error: `启动下载失败: ${err.message}`,
        detail: err.stack || err.message
      } as ErrorPayload)
      this.downloads.delete(taskId)
      this.processQueue(win)
    })
  }

  private processQueue(win: BrowserWindow): void {
    while (this.getActiveCount() < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) this.startDownloadInternal(next.taskId, next.req, win)
    }
  }

  private getActiveCount(): number {
    return Array.from(this.downloads.values())
      .filter(d => d.status === 'downloading' || d.status === 'post-processing')
      .length
  }

  private parseOutput(
    proc: ChildProcess,
    managed: ManagedDownload,
    win: BrowserWindow,
    output: { stderr: string }
  ): void {
    let buffer = ''

    proc.stdout.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) this.handleOutputLine(line, managed, win)
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      output.stderr += text
      for (const line of text.split('\n')) this.handleOutputLine(line, managed, win)
    })
  }

  private handleOutputLine(line: string, managed: ManagedDownload, win: BrowserWindow): void {
    const match = line.match(
      /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+[KMG]?i?B)\s+at\s+(\S+)\s+ETA\s+([\d:]+)/
    )

    if (match) {
      managed.progress = parseFloat(match[1]) || 0
      managed.totalBytes = this.parseSize(match[2])
      managed.speed = match[3]
      managed.eta = match[4]
      managed.downloadedBytes = Math.round(managed.totalBytes * managed.progress / 100)
      managed.status = 'downloading'

      win.webContents.send('download:progress', {
        taskId: managed.taskId,
        percentage: managed.progress,
        speed: managed.speed,
        eta: managed.eta,
        downloadedBytes: managed.downloadedBytes,
        totalBytes: managed.totalBytes,
        status: 'downloading'
      } as ProgressPayload)
    }

    const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/)
    if (destMatch) {
      managed.destLine = destMatch[1].trim()
    }

    if (line.includes('[Merger]') || line.includes('Merging formats')) {
      managed.status = 'post-processing'
      win.webContents.send('download:progress', {
        taskId: managed.taskId,
        percentage: 99,
        speed: '',
        eta: '',
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'post-processing'
      } as ProgressPayload)
    }
  }

  private formatDownloadError(stderr: string, code: number | null): string {
    if (stderr.includes('Could not copy Chrome cookie database')) {
      return '下载失败：无法读取浏览器 Cookie，请关闭浏览器或改用 cookies.txt'
    }
    if (stderr.includes('Only images are available') || stderr.includes('No downloadable formats')) {
      return '下载失败：YouTube 只返回了缩略图格式，请使用 cookies.txt 或配置 JS Runtime'
    }
    if (stderr.includes('n challenge solving failed') || stderr.includes('No supported JavaScript runtime')) {
      return '下载失败：YouTube 挑战解析失败，请安装 Deno 或 Node 22+'
    }
    if (stderr.includes('PO Token')) {
      return '下载失败：YouTube 当前需要 PO Token 或登录 Cookie'
    }
    if (stderr.includes('DRM protected')) return '下载失败：该视频受 DRM 保护'
    if (stderr.includes('Sign in') || stderr.includes('login') || stderr.includes('cookies')) {
      return '下载失败：可能需要登录 Cookie'
    }
    if (stderr.includes('HTTP Error 403') || stderr.includes('Forbidden')) {
      return '下载失败：访问被拒绝，请检查 Cookie 或代理'
    }
    if (stderr.includes('Unsupported URL')) return '下载失败：不支持的链接'
    if (stderr.includes('Video unavailable') || stderr.includes('not available')) {
      return '下载失败：视频不可用或有地区限制'
    }
    if (stderr.includes('Requested format is not available')) {
      return '下载失败：所选格式不可用，请重新解析后选择其他格式'
    }
    return `下载失败 (退出码 ${code ?? 'unknown'})`
  }

  private sanitizeFilename(name: string): string {
    return name
      .normalize('NFKC')
      .replace(/\uFFFD/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+/, '')
      .replace(/_+/g, '_')
      .replace(/[\s.]+$/, '')
      .substring(0, 200) || 'video'
  }

  private resolveDownloadedPath(outputDir: string, filename: string, destLine: string, outputTemplate: string): string {
    const candidates = [
      destLine,
      outputTemplate.replace(/\.%\(ext\)s$/, '')
    ].filter(Boolean)

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }

    try {
      const files = fs.readdirSync(outputDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.join(outputDir, entry.name))
        .filter(file => path.basename(file, path.extname(file)) === filename)
        .map(file => ({ file, time: fs.statSync(file).mtimeMs }))
        .sort((a, b) => b.time - a.time)

      if (files[0]) return files[0].file
    } catch {
      // Fall back below.
    }

    return destLine || outputTemplate.replace(/\.%\(ext\)s$/, '')
  }

  private parseSize(text: string): number {
    const units: Record<string, number> = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 }
    const match = text.match(/^([\d.]+)\s*(B|KiB|MiB|GiB)$/)
    if (!match) return 0
    return parseFloat(match[1]) * (units[match[2]] ?? 1)
  }
}
