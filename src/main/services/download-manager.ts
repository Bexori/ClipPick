import { ChildProcess, spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import { app, BrowserWindow, Notification } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getBinaryPath, getFfmpegPath } from '../utils/paths'
import { spawnSafe } from '../utils/spawn-safe'
import { logger } from '../utils/logger'
import type { StartDownloadRequest, ProgressPayload, CompletePayload, ErrorPayload, DownloadTask, DownloadStatus } from '../../shared/types'
import { buildDownloadArgs } from './yt-dlp-args'
import { SettingsService } from './settings.service'

function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return
  if (os.platform() === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore', windowsHide: true })
  } else {
    proc.kill('SIGTERM')
  }
}

interface ParsedDownloadProgress {
  percentage: number
  totalBytes: number
  speed: string
  eta: string
}

interface ManagedDownload {
  taskId: string
  process: ChildProcess | null
  status: DownloadStatus
  progress: number
  speed: string
  eta: string
  downloadedBytes: number
  totalBytes: number
  outputPath: string
  destLine: string
  req: StartDownloadRequest
  cookieFallbackTried: boolean
}

interface QueuedDownload {
  taskId: string
  req: StartDownloadRequest
}

interface PersistedEntry {
  taskId: string
  req: StartDownloadRequest
  progress: number
  downloadedBytes: number
  totalBytes: number
  status: DownloadStatus
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
        error: 'Download failed: video URL is empty',
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
      destLine: '',
      req,
      cookieFallbackTried: false
    }

    this.downloads.set(taskId, managed)

    if (this.getActiveCount() >= this.maxConcurrent) {
      this.queue.push({ taskId, req })
      this.persistQueue()
      return taskId
    }

    this.startDownloadInternal(taskId, req, win)
    this.persistQueue()
    return taskId
  }

  cancelDownload(taskId: string): boolean {
    const dl = this.downloads.get(taskId)
    if (!dl) return false

    if (dl.status === 'queued') {
      dl.status = 'cancelled'
      this.queue = this.queue.filter(item => item.taskId !== taskId)
      this.downloads.delete(taskId)
      this.persistQueue()
      return true
    }

    dl.status = 'cancelled'
    if (dl.process) killProcessTree(dl.process)
    this.persistQueue()
    return true
  }

  recoverUnfinished(): DownloadTask[] {
    const persisted = this.loadPersistedQueue()
    const recovered: DownloadTask[] = []

    for (const entry of persisted) {
      if (entry.status === 'downloading' || entry.status === 'queued') {
        const task: DownloadTask = {
          taskId: entry.taskId,
          videoId: '',
          title: entry.req.filename,
          thumbnail: '',
          url: entry.req.url,
          duration: 0,
          formatId: entry.req.formatId,
          formatLabel: '',
          outputDir: entry.req.outputDir,
          filename: entry.req.filename,
          status: 'error',
          progress: entry.progress,
          speed: '',
          eta: '',
          downloadedBytes: entry.downloadedBytes,
          totalBytes: entry.totalBytes,
          error: 'Download was interrupted. Please requeue it.',
          retryCount: 0,
          maxRetries: this.settings.get().autoRetryCount,
          createdAt: new Date().toISOString()
        }
        recovered.push(task)
      }
    }

    this.clearPersistedQueue()
    logger.info(`Recovered ${recovered.length} unfinished download(s) from previous session`)
    return recovered
  }

  private handleProcessClose(
    code: number | null,
    managed: ManagedDownload,
    win: BrowserWindow,
    output: { stderr: string }
  ): void {
    if (code === 0 || managed.progress >= 100) {
      managed.status = 'completed'
      managed.progress = 100
      const finalPath = this.resolveDownloadedPath(
        managed.req.outputDir,
        this.buildOutputBasename(managed.req),
        managed.destLine,
        managed.outputPath
      )
      const subtitleFiles = this.findSubtitleFiles(managed.req.outputDir, this.buildOutputBasename(managed.req))
      const subtitleStatus = this.resolveSubtitleStatus(managed.req, output.stderr, subtitleFiles)
      logger.info(`Download completed: ${managed.taskId} -> ${finalPath}`)
      win.webContents.send('download:complete', {
        taskId: managed.taskId,
        filepath: finalPath,
        filesize: managed.totalBytes,
        subtitleFiles,
        subtitleStatus
      } as CompletePayload)

      if (this.settings.get().downloadNotifications && Notification.isSupported()) {
        const n = new Notification({
          title: 'Download complete',
          body: managed.req.filename || 'Video download complete',
          silent: false
        })
        n.on('click', () => {
          if (!win.isDestroyed()) {
            win.show()
            win.focus()
          }
        })
        n.show()
      }
    } else if (managed.status !== 'cancelled') {
      const detail = output.stderr.trim()

      if (this.shouldRetryWithoutBrowserCookies(managed, detail)) {
        logger.warn(`Download browser cookie read failed, retrying without browser cookies: ${managed.taskId}`)
        managed.cookieFallbackTried = true
        managed.progress = 0
        managed.speed = ''
        managed.eta = ''
        managed.downloadedBytes = 0
        managed.totalBytes = 0
        managed.destLine = ''
        this.startDownloadInternal(managed.taskId, managed.req, win)
        return
      }

      managed.status = 'error'
      logger.error(`Download failed: ${managed.taskId} (code=${code}) ${detail}`)
      win.webContents.send('download:error', {
        taskId: managed.taskId,
        error: this.formatDownloadError(detail, code),
        detail
      } as ErrorPayload)
    }

    setTimeout(() => {
      this.downloads.delete(managed.taskId)
      this.persistQueue()
      this.processQueue(win)
    }, 1000)
  }

  private startDownloadInternal(taskId: string, req: StartDownloadRequest, win: BrowserWindow): void {
    const managed = this.downloads.get(taskId)
    if (!managed) return

    const filename = this.buildOutputBasename(req)
    const outputTemplate = `${req.outputDir}\\${filename}.%(ext)s`
    const currentSettings = this.settings.get()
    const effectiveSettings = managed.cookieFallbackTried
      ? { ...currentSettings, cookieMode: 'auto' as const, cookiesFile: '' }
      : currentSettings
    const args = buildDownloadArgs(req.url, req.formatId, outputTemplate, this.ffmpegPath, effectiveSettings, {
      writeSubs: req.writeSubs,
      writeAutoSubs: req.writeAutoSubs,
      subLangs: req.subLangs,
      embedSubs: req.embedSubs
    })
    const proc = spawnSafe(this.ytDlpPath, args)
    const output = { stderr: '' }

    Object.assign(managed, {
      process: proc,
      status: 'downloading',
      outputPath: outputTemplate,
      req
    })

    logger.info(`Download started: ${taskId} "${filename}" (${req.formatId})`)

    this.parseOutput(proc, managed, win, output)

    proc.on('close', (code) => {
      this.handleProcessClose(code, managed, win, output)
    })

    proc.on('error', (err) => {
      if (managed.status === 'cancelled') return
      managed.status = 'error'
      logger.error(`Download process error: ${taskId}`, err)
      win.webContents.send('download:error', {
        taskId,
        error: `下载进程启动失败: ${err.message}`,
        detail: err.stack || err.message
      } as ErrorPayload)
      this.downloads.delete(taskId)
      this.persistQueue()
      this.processQueue(win)
    })
  }

  private processQueue(win: BrowserWindow): void {
    while (this.getActiveCount() < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) this.startDownloadInternal(next.taskId, next.req, win)
    }
    this.persistQueue()
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

    proc.stdout!.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) this.handleOutputLine(line, managed, win)
    })

    proc.stderr!.on('data', (data: Buffer) => {
      const text = data.toString()
      output.stderr += text
      for (const line of text.split('\n')) this.handleOutputLine(line, managed, win)
    })
  }

  private handleOutputLine(line: string, managed: ManagedDownload, win: BrowserWindow): void {
    const progress = this.parseDownloadProgress(line)

    if (progress) {
      managed.progress = progress.percentage
      managed.totalBytes = progress.totalBytes
      managed.speed = progress.speed
      managed.eta = progress.eta
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

  // ========== Queue Persistence ==========

  private getPersistPath(): string {
    try {
      return path.join(app.getPath('userData'), 'download-queue.json')
    } catch (err) {
      const fallback = path.join(process.cwd(), 'download-queue.json')
      logger.warn(`getPersistPath: falling back to cwd. userData error: ${String(err)}. Using: ${fallback}`)
      return fallback
    }
  }

  private persistQueue(): void {
    try {
      const entries: PersistedEntry[] = []
      for (const dl of this.downloads.values()) {
        if (dl.status === 'completed' || dl.status === 'cancelled') continue
        entries.push({
          taskId: dl.taskId,
          req: dl.req,
          progress: dl.progress,
          downloadedBytes: dl.downloadedBytes,
          totalBytes: dl.totalBytes,
          status: dl.status
        })
      }
      // Also persist queued items not yet in downloads map
      for (const q of this.queue) {
        if (!entries.some(e => e.taskId === q.taskId)) {
          entries.push({
            taskId: q.taskId,
            req: q.req,
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            status: 'queued'
          })
        }
      }
      fs.writeFileSync(this.getPersistPath(), JSON.stringify(entries, null, 2), 'utf-8')
    } catch (err) {
      logger.warn('Failed to persist download queue', err)
    }
  }

  private loadPersistedQueue(): PersistedEntry[] {
    try {
      const raw = fs.readFileSync(this.getPersistPath(), 'utf-8')
      const data: unknown = JSON.parse(raw)
      if (!Array.isArray(data)) return []
      return data.filter(isPersistedEntry)
    } catch {
      return []
    }
  }

  clearPersistedQueue(): void {
    try {
      const p = this.getPersistPath()
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch { /* ignore */ }
  }

  // ========== Helpers ==========

  private shouldRetryWithoutBrowserCookies(managed: ManagedDownload, stderr: string): boolean {
    if (managed.cookieFallbackTried) return false
    if (this.settings.get().cookieMode !== 'browser') return false
    if (!this.isYoutubeUrl(managed.req.url)) return false
    return stderr.includes('Could not copy Chrome cookie database') ||
      stderr.includes('unable to read browser cookies')
  }

  private isYoutubeUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname.includes('youtube.com') || hostname === 'youtu.be'
    } catch {
      return false
    }
  }

  private extractMeaningfulDownloadError(stderr: string): string | null {
    const lines = stderr
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)

    const ignoredPrefixes = [
      '[download]',
      '[debug]',
      'warning: your yt-dlp version',
      'it is strongly recommended',
      'run "yt-dlp --update"',
      'to suppress this warning'
    ]

    const preferred = lines.find(line => /^(error:|download failed:|unable to|http error|requested format|sign in|forbidden)/i.test(line))
    if (preferred) return preferred.replace(/^error:\s*/i, "").trim()

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]
      if (ignoredPrefixes.some(prefix => line.toLowerCase().startsWith(prefix))) continue
      if (line.length < 6) continue
      return line.replace(/^error:\s*/i, "").trim()
    }

    return null
  }

  private formatDownloadError(stderr: string, code: number | null): string {
    if (stderr.includes('Could not copy Chrome cookie database')) {
      return '下载失败：无法读取浏览器 Cookie，请先完全关闭 Chrome 后重试，或改用 cookies.txt'
    }
    if (stderr.includes('unable to read browser cookies')) {
      return '下载失败：浏览器 Cookie 读取失败，请关闭浏览器后重试，或改用 cookies.txt'
    }
    if (stderr.includes('Only images are available') || stderr.includes('No downloadable formats')) {
      return '下载失败：当前链接没有可下载的视频格式'
    }
    if (stderr.includes('n challenge solving failed') || stderr.includes('No supported JavaScript runtime')) {
      return '下载失败：站点挑战校验失败，请安装 Deno 或 Node 22+'
    }
    if (stderr.includes('PO Token')) {
      return '下载失败：YouTube 当前需要 PO Token 或有效登录 Cookie'
    }
    if (stderr.includes('DRM protected')) return '下载失败：该视频受 DRM 保护'
    if (stderr.includes('Sign in') || stderr.includes('login') || stderr.includes('cookies')) {
      return '下载失败：可能需要有效登录 Cookie'
    }
    if (stderr.includes('HTTP Error 403') || stderr.includes('Forbidden')) {
      return '下载失败：访问被拒绝，请检查 Cookie 或代理设置'
    }
    if (stderr.includes('Unsupported URL')) return '下载失败：当前链接暂不支持'
    if (stderr.includes('Video unavailable') || stderr.includes('not available')) {
      return '下载失败：视频不可用或受地区限制'
    }
    if (stderr.includes('Requested format is not available')) {
      return '下载失败：当前选择的格式已不可用，请重新解析后再试'
    }

    const meaningful = this.extractMeaningfulDownloadError(stderr)
    if (meaningful) {
      return `下载失败：${meaningful}`
    }

    return `下载失败（退出码 ${code ?? 'unknown'}）`
  }

  private sanitizeFilename(name: string): string {
    return name
      .normalize('NFKC')
      .replace(/\uFFFD/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(new RegExp("[<>:\"'/\\\\|?*]", "g"), "_")
      .replace(/^\.+/, '')
      .replace(/_+/g, '_')
      .replace(/[\s.]+$/, '')
      .substring(0, 200) || 'video'
  }

  private buildOutputBasename(req: StartDownloadRequest): string {
    const title = this.sanitizeFilename(req.filename)
    const formatSuffix = this.sanitizeFilename(req.formatLabel || req.formatId)
      .replace(/\+/g, '_')
      .replace(/_best(?:audio|video)?/g, '')
      .substring(0, 60)

    return formatSuffix ? `${title} [${formatSuffix}]` : title
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

  private findSubtitleFiles(outputDir: string, filename: string): string[] {
    const subtitleExts = new Set(['.srt', '.ass', '.ssa', '.vtt', '.lrc', '.ttml', '.srv3', '.json3'])
    const prefix = `${filename}.`

    try {
      return fs.readdirSync(outputDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => name.startsWith(prefix) && subtitleExts.has(path.extname(name).toLowerCase()))
        .map(name => path.join(outputDir, name))
        .sort((a, b) => a.localeCompare(b))
    } catch {
      return []
    }
  }

  private resolveSubtitleStatus(
    req: StartDownloadRequest,
    stderr: string,
    subtitleFiles: string[]
  ): CompletePayload['subtitleStatus'] {
    const requested = Boolean(req.writeSubs || req.writeAutoSubs)
    if (!requested) return 'none'

    const logText = stderr.toLowerCase()
    const embedRequested = Boolean(req.embedSubs)
    const embedSucceeded =
      logText.includes('embedsubtitle') ||
      logText.includes('embedding subtitles') ||
      logText.includes('subtitles embedded')
    const embedFailed =
      logText.includes("there aren't any subtitles to embed") ||
      logText.includes('unable to embed subtitles') ||
      logText.includes('cannot embed subtitles') ||
      logText.includes('subtitle embedding failed')

    if (embedRequested && embedSucceeded && subtitleFiles.length === 0) {
      return 'embedded'
    }

    if (subtitleFiles.length > 0) {
      if (embedRequested && embedFailed) return 'embed-failed'
      return 'external'
    }

    if (embedRequested && embedSucceeded) return 'embedded'
    return 'none'
  }

  private parseSize(text: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1000,
      MB: 1000 ** 2,
      GB: 1000 ** 3,
      KiB: 1024,
      MiB: 1024 ** 2,
      GiB: 1024 ** 3
    }
    const match = text.match(/^([\d.]+)\s*(B|KB|MB|GB|KiB|MiB|GiB)$/)
    if (!match) return 0
    return parseFloat(match[1]) * (units[match[2]] ?? 1)
  }

  private parseDownloadProgress(line: string): ParsedDownloadProgress | null {
    if (!line.includes('[download]') || !line.includes('%')) return null

    const percentage = Number.parseFloat(line.match(/([\d.]+)%/)?.[1] ?? '')
    if (!Number.isFinite(percentage)) return null

    const totalText = line.match(/\bof\s+~?\s*([\d.]+\s*(?:B|KB|MB|GB|KiB|MiB|GiB))/)?.[1] ?? ''
    const speed = line.match(/\bat\s+(\S+)/)?.[1] ?? ''
    const eta = line.match(/\bETA\s+([\d:]+)/)?.[1] ?? ''

    return {
      percentage,
      totalBytes: totalText ? this.parseSize(totalText.replace(/\s+/g, '')) : 0,
      speed,
      eta
    }
  }
}

function isPersistedEntry(value: unknown): value is PersistedEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<PersistedEntry>
  const req = entry.req as Partial<StartDownloadRequest> | undefined
  if (!req) return false
  return typeof entry.taskId === 'string' &&
    typeof entry.progress === 'number' &&
    typeof entry.downloadedBytes === 'number' &&
    typeof entry.totalBytes === 'number' &&
    typeof entry.status === 'string' &&
    typeof req.url === 'string' &&
    typeof req.formatId === 'string' &&
    typeof req.outputDir === 'string' &&
    typeof req.filename === 'string'
}
