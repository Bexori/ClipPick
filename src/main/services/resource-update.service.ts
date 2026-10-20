import { net } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import { getBinaryPath } from '../utils/paths'

export type UpdatableResource = 'yt-dlp' | 'ffmpeg'

export interface ResourceUpdateResult {
  resource: UpdatableResource
  version: string
}

const DOWNLOAD_URLS: Record<UpdatableResource, string> = {
  'yt-dlp': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  ffmpeg: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip'
}

async function downloadToFile(url: string, target: string, maxBytes: number): Promise<void> {
  const response = await net.fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`下载资源失败（HTTP ${response.status}）`)
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > maxBytes) throw new Error('下载资源大小异常，已停止更新')

  await pipeline(
    Readable.fromWeb(response.body as any),
    fs.createWriteStream(target)
  )

  const downloadedSize = fs.statSync(target).size
  if (!downloadedSize || downloadedSize > maxBytes) throw new Error('下载资源大小异常，已停止更新')
}

function runVersionCommand(binaryPath: string, args: string[]): string {
  const result = spawnSync(binaryPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000
  })
  if (result.error || result.status !== 0) {
    throw new Error('下载的资源校验失败，未能正常启动')
  }
  return `${result.stdout || result.stderr || ''}`.split(/\r?\n/)[0].trim()
}

function findFile(root: string, filename: string): string | null {
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) return fullPath
    if (entry.isDirectory()) {
      const nested = findFile(fullPath, filename)
      if (nested) return nested
    }
  }
  return null
}

function replaceFiles(files: Array<{ source: string; target: string }>): void {
  const updateId = randomUUID()
  const backups = files.map(file => ({
    ...file,
    staged: `${file.target}.clippick-staged-${updateId}`,
    backup: `${file.target}.clippick-backup-${updateId}`,
    movedOld: false,
    installed: false
  }))

  const retry = (operation: () => void): void => {
    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        operation()
        return
      } catch (error) {
        lastError = error
        if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
      }
    }
    throw lastError
  }

  try {
    // The temporary download directory may be on another drive (for example C: vs D:).
    // Copy into the target directory first so the final renames stay on one volume.
    for (const file of backups) retry(() => fs.copyFileSync(file.source, file.staged))
    for (const file of backups) {
      retry(() => fs.renameSync(file.target, file.backup))
      file.movedOld = true
    }
    for (const file of backups) {
      retry(() => fs.renameSync(file.staged, file.target))
      file.installed = true
    }
    for (const file of backups) {
      // Cleanup is best effort after the new file is already installed. A
      // short-lived antivirus lock must not make a successful update look like
      // a failed replacement.
      try { fs.rmSync(file.backup, { force: true }) } catch { /* retry on next update */ }
      try { fs.rmSync(file.staged, { force: true }) } catch { /* cleanup is best effort */ }
    }
  } catch (error) {
    for (const file of backups) {
      try {
        if (file.installed && fs.existsSync(file.target)) fs.rmSync(file.target, { force: true })
        if (fs.existsSync(file.staged)) fs.rmSync(file.staged, { force: true })
        if (file.movedOld && fs.existsSync(file.backup)) fs.renameSync(file.backup, file.target)
      } catch {
        // Keep the original error; an untouched backup remains available for manual recovery.
      }
    }
    throw error
  }
}

function replaceFile(source: string, target: string): void {
  replaceFiles([{ source, target }])
}

function extractZip(archive: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true })
  const result = spawnSync('tar', ['-xf', archive, '-C', destination], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000
  })
  if (result.error || result.status !== 0) {
    throw new Error('无法解压 FFmpeg 更新包，请确认系统支持 ZIP 解压')
  }
}

export class ResourceUpdateService {
  async update(resource: UpdatableResource): Promise<ResourceUpdateResult> {
    const resourceTarget = getBinaryPath(resource === 'yt-dlp' ? 'yt-dlp.exe' : 'ffmpeg.exe')
    // Keep staging on the same volume as the installed resources so the final
    // rename remains atomic on Windows and cannot fail with cross-drive EPERM.
    const tempRoot = fs.mkdtempSync(path.join(path.dirname(resourceTarget), '.clippick-update-'))

    try {
      if (resource === 'yt-dlp') {
        const downloaded = path.join(tempRoot, 'yt-dlp.exe')
        await downloadToFile(DOWNLOAD_URLS[resource], downloaded, 100 * 1024 * 1024)
        if (fs.statSync(downloaded).size < 1024 * 1024) throw new Error('下载的 yt-dlp 文件过小，已停止更新')
        const version = runVersionCommand(downloaded, ['--version'])
        replaceFile(downloaded, resourceTarget)
        return { resource, version }
      }

      const ffmpegTarget = getBinaryPath('ffmpeg.exe')
      const ffprobeTarget = getBinaryPath('ffprobe.exe')
      const archive = path.join(tempRoot, 'ffmpeg.zip')
      const extracted = path.join(tempRoot, 'extracted')
      await downloadToFile(DOWNLOAD_URLS[resource], archive, 500 * 1024 * 1024)
      if (fs.statSync(archive).size < 10 * 1024 * 1024) throw new Error('下载的 FFmpeg 更新包过小，已停止更新')
      extractZip(archive, extracted)

      const newFfmpeg = findFile(extracted, 'ffmpeg.exe')
      const newFfprobe = findFile(extracted, 'ffprobe.exe')
      if (!newFfmpeg || !newFfprobe) throw new Error('更新包中未找到 FFmpeg 可执行文件')

      const version = runVersionCommand(newFfmpeg, ['-version'])
      replaceFiles([
        { source: newFfmpeg, target: ffmpegTarget },
        { source: newFfprobe, target: ffprobeTarget }
      ])
      return { resource, version }
    } finally {
      // The binaries may be briefly scanned by Windows Defender after the
      // replacement. Cleanup must not turn a successful update into an error.
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true })
      } catch {
        // The leftover staging folder is harmless and can be cleaned later.
      }
    }
  }
}
