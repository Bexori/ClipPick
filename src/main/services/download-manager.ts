import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { getBinaryPath, getFfmpegPath } from '../utils/paths'
import type { StartDownloadRequest, ProgressPayload } from '../../shared/types'

interface ManagedDownload {
  taskId: string
  process: ChildProcess
  status: string
  progress: number
  speed: string
  eta: string
  downloadedBytes: number
  totalBytes: number
  outputPath: string
  destLine: string
}

export class DownloadManager {
  private downloads = new Map<string, ManagedDownload>()
  private maxConcurrent = 3
  private queue: StartDownloadRequest[] = []
  private ytDlpPath: string
  private ffmpegPath: string

  constructor() {
    this.ytDlpPath = getBinaryPath('yt-dlp.exe')
    this.ffmpegPath = getFfmpegPath()
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n
  }

  startDownload(req: StartDownloadRequest, win: BrowserWindow): string {
    const activeCount = Array.from(this.downloads.values())
      .filter(d => d.status === 'downloading').length

    if (activeCount >= this.maxConcurrent) {
      this.queue.push(req)
      const taskId = randomUUID()
      const managed: ManagedDownload = {
        taskId, process: null as any, status: 'queued',
        progress: 0, speed: '', eta: '',
        downloadedBytes: 0, totalBytes: 0,
        outputPath: '', destLine: ''
      }
      this.downloads.set(taskId, managed)
      return taskId
    }

    return this.startDownloadInternal(req, win)
  }

  private startDownloadInternal(req: StartDownloadRequest, win: BrowserWindow): string {
    const taskId = randomUUID()
    const filename = this.sanitizeFilename(req.filename)
    const outputTemplate = `${req.outputDir}\\${filename}.%(ext)s`

    const args = [
      req.url,
      '-f', req.formatId,
      '-o', outputTemplate,
      '--newline',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-check-certificates'
    ]

    if (this.ffmpegPath) {
      args.push('--ffmpeg-location', this.ffmpegPath)
    }

    const proc = spawn(this.ytDlpPath, args)

    const managed: ManagedDownload = {
      taskId, process: proc,
      status: 'downloading',
      progress: 0, speed: '', eta: '',
      downloadedBytes: 0, totalBytes: 0,
      outputPath: outputTemplate,
      destLine: ''
    }

    this.downloads.set(taskId, managed)
    this.parseOutput(proc, managed, win)

    proc.on('close', (code) => {
      if (code === 0 || managed.progress >= 100) {
        managed.status = 'completed'
        managed.progress = 100
        const finalPath = managed.destLine || managed.outputPath
        win.webContents.send('download:complete', {
          taskId,
          filepath: finalPath,
          filesize: managed.totalBytes
        } as import('../../shared/types').CompletePayload)
      } else if (managed.status !== 'cancelled') {
        managed.status = 'error'
        win.webContents.send('download:error', {
          taskId,
          error: `下载失败 (退出码 ${code})`
        })
      }
      setTimeout(() => {
        this.downloads.delete(taskId)
        this.processQueue(win)
      }, 10000)
    })

    proc.on('error', (err) => {
      managed.status = 'error'
      win.webContents.send('download:error', {
        taskId,
        error: `启动下载失败: ${err.message}`
      })
      this.downloads.delete(taskId)
      this.processQueue(win)
    })

    return taskId
  }

  cancelDownload(taskId: string): boolean {
    const dl = this.downloads.get(taskId)
    if (!dl) return false

    if (dl.status === 'queued') {
      dl.status = 'cancelled'
      this.queue = this.queue.filter((_, i) => true) // clear matching later
      return true
    }

    dl.status = 'cancelled'
    dl.process.kill('SIGTERM')
    return true
  }

  private processQueue(win: BrowserWindow): void {
    const activeCount = Array.from(this.downloads.values())
      .filter(d => d.status === 'downloading').length
    let next: StartDownloadRequest | undefined

    while (activeCount < this.maxConcurrent && this.queue.length > 0) {
      next = this.queue.shift()
      if (next) this.startDownloadInternal(next, win)
    }
  }

  private parseOutput(proc: ChildProcess, managed: ManagedDownload, win: BrowserWindow): void {
    let buffer = ''

    proc.stdout.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        // yt-dlp progress: [download]  12.5% of ~123.45MiB at 3.45MiB/s ETA 00:31
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

        // 捕获目标文件路径
        const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/)
        if (destMatch) {
          managed.destLine = destMatch[1].trim()
        }

        // 检测合并/后处理阶段
        if (line.includes('[Merger]') || line.includes('Merging formats')) {
          managed.status = 'post-processing'
          win.webContents.send('download:progress', {
            taskId: managed.taskId,
            percentage: 99, speed: '', eta: '',
            downloadedBytes: 0, totalBytes: 0,
            status: 'post-processing'
          } as ProgressPayload)
        }
      }
    })

    // 也监听 stderr (某些版本的 yt-dlp 进度输出到 stderr)
    proc.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
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
      }
    })
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+/, '')
      .replace(/[\s.]+$/, '')
      .substring(0, 200) || 'video'
  }

  private parseSize(text: string): number {
    const units: Record<string, number> = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 }
    const match = text.match(/^([\d.]+)\s*(B|KiB|MiB|GiB)$/)
    if (!match) return 0
    return parseFloat(match[1]) * (units[match[2]] ?? 1)
  }
}
