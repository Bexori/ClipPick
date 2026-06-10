import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IpcChannels } from '../../shared/types'
import type { StartDownloadRequest, HistoryEntry, ProgressPayload, CompletePayload, ErrorPayload } from '../../shared/types'
import { YtDlpService } from '../services/yt-dlp.service'
import { DownloadManager } from '../services/download-manager'
import { FfmpegService } from '../services/ffmpeg.service'
import { HistoryService } from '../services/history.service'
import { SettingsService } from '../services/settings.service'

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
  settings: SettingsService
): void {
  // ========== yt-dlp ==========
  ipcMain.handle(IpcChannels.YTDLP_PARSE_URL, async (_event, { url }: { url: string }) => {
    return await ytDlp.parseVideo(url)
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
}
