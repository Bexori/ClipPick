import { app, BrowserWindow, Menu, session } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { YtDlpService } from './services/yt-dlp.service'
import { DownloadManager } from './services/download-manager'
import { FfmpegService } from './services/ffmpeg.service'
import { HistoryService } from './services/history.service'
import { SettingsService } from './services/settings.service'

let mainWindow: BrowserWindow | null = null

function registerImageRequestHeaders(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.hdslb.com/*', '*://hdslb.com/*'] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          Referer: 'https://www.bilibili.com/',
          Origin: 'https://www.bilibili.com',
          'User-Agent': details.requestHeaders['User-Agent'] ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      })
    }
  )
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 750,
    minHeight: 500,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    title: '影盒'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerImageRequestHeaders()

  const settings = new SettingsService()
  const ytDlp = new YtDlpService(settings)
  const history = new HistoryService()
  const downloadManager = new DownloadManager(settings)
  const ffmpeg = new FfmpegService()

  createWindow()

  registerIpcHandlers(mainWindow!, ytDlp, downloadManager, ffmpeg, history, settings)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
