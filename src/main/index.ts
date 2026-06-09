import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { YtDlpService } from './services/yt-dlp.service'
import { DownloadManager } from './services/download-manager'
import { FfmpegService } from './services/ffmpeg.service'
import { HistoryService } from './services/history.service'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'VideoBox'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const ytDlp = new YtDlpService()
  const history = new HistoryService()
  const downloadManager = new DownloadManager()
  const ffmpeg = new FfmpegService()

  createWindow()

  registerIpcHandlers(mainWindow!, ytDlp, downloadManager, ffmpeg, history)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
