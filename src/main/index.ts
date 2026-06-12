import { app, BrowserWindow, Menu, nativeImage, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipc'
import { YtDlpService } from './services/yt-dlp.service'
import { DownloadManager } from './services/download-manager'
import { FfmpegService } from './services/ffmpeg.service'
import { HistoryService } from './services/history.service'
import { SettingsService } from './services/settings.service'
import { BilibiliAuthService } from './services/bilibili-auth.service'
import { SavedUrlsService } from './services/saved-urls.service'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

app.name = '影拾'

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('in-process-gpu')

// 开发版使用独立的 userData 目录，避免与安装版共享配置/历史/队列
if (!app.isPackaged) {
  app.setPath('userData', app.getPath('userData') + '-dev')
}

process.on('uncaughtException', (error) => {
  logger.capture('main uncaughtException', error)
})

process.on('unhandledRejection', (error) => {
  logger.capture('main unhandledRejection', error)
})

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
  const preloadPath = join(__dirname, '../preload/index.js')
  const indexPath = join(__dirname, '../renderer/index.html')

  logger.info(`preload path: ${preloadPath}  exists=${existsSync(preloadPath)}`)
  logger.info(`renderer index path: ${indexPath}  exists=${existsSync(indexPath)}`)

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.ico')
    : join(__dirname, '../../resources/icon.ico')
  logger.info(`icon path: ${iconPath}  exists=${existsSync(iconPath)}`)

  const winIcon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 750,
    minHeight: 500,
    autoHideMenuBar: true,
    icon: winIcon,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发版在标题上加标识（HTML <title> 会覆盖窗口 title，需要拦截）
  if (!app.isPackaged) {
    mainWindow.on('page-title-updated', (event) => {
      event.preventDefault()
      mainWindow?.setTitle('影拾 (开发版)')
    })
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.capture('renderer process gone', details)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.capture('did-fail-load', { errorCode, errorDescription, validatedURL })
  })

  app.on('child-process-gone', (_event, details) => {
    logger.capture('child process gone', details)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    logger.info('Loading dev URL: ' + process.env.ELECTRON_RENDERER_URL)
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    logger.info('Loading file: ' + indexPath)
    mainWindow.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  logger.info(`App ready. packaged=${app.isPackaged}`)
  logger.info(`  cwd:            ${process.cwd()}`)
  logger.info(`  __dirname:      ${__dirname}`)
  logger.info(`  resourcesPath:  ${process.resourcesPath}`)
  logger.info(`  appPath:        ${app.getAppPath()}`)
  logger.info(`  userData:       ${app.getPath('userData')}`)
  logger.info(`  exe:            ${app.getPath('exe')}`)
  Menu.setApplicationMenu(null)
  registerImageRequestHeaders()

  logger.info('Initializing services')
  const settings = new SettingsService()
  const ytDlp = new YtDlpService(settings)
  const history = new HistoryService()
  const downloadManager = new DownloadManager(settings)
  const ffmpeg = new FfmpegService()
  const bilibili = new BilibiliAuthService(settings)
  const savedUrls = new SavedUrlsService()

  logger.info('Creating main window')
  createWindow()

  logger.info('Registering IPC handlers')
  registerIpcHandlers(mainWindow!, ytDlp, downloadManager, ffmpeg, history, settings, bilibili, savedUrls)
  logger.info('App startup complete')
}).catch((error) => {
  logger.capture('app.whenReady failed', error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
