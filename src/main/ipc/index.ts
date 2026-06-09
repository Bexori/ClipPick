import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { IpcChannels } from '../../shared/types'
import type { StartDownloadRequest, HistoryEntry, ProgressPayload, CompletePayload, ErrorPayload } from '../../shared/types'
import { YtDlpService } from '../services/yt-dlp.service'
import { DownloadManager } from '../services/download-manager'
import { FfmpegService } from '../services/ffmpeg.service'
import { HistoryService } from '../services/history.service'

export function registerIpcHandlers(
  win: BrowserWindow,
  ytDlp: YtDlpService,
  downloadManager: DownloadManager,
  ffmpeg: FfmpegService,
  history: HistoryService
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
    shell.showItemInFolder(filepath)
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

  // ========== App ==========
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IpcChannels.APP_OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
    shell.openExternal(url)
  })
}
