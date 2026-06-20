import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  StartDownloadRequest, HistoryEntry, ProgressPayload,
  CompletePayload, ErrorPayload, FfmpegRequest, VideoParseResult, AppSettings,
  TranslateRequest, TranslateResult, SavedUrlEntry, PlaylistParseResult
} from '../shared/types'

const api = {
  // Video parsing
  parseVideo: (url: string): Promise<VideoParseResult> =>
    ipcRenderer.invoke('yt-dlp:parse-url', { url }),
  parsePlaylist: (url: string): Promise<PlaylistParseResult> =>
    ipcRenderer.invoke('yt-dlp:parse-playlist', { url }),

  // Download
  startDownload: (opts: StartDownloadRequest): Promise<string> =>
    ipcRenderer.invoke('download:start', opts),
  cancelDownload: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('download:cancel', { taskId }),
  recoverUnfinished: (): Promise<import('../shared/types').DownloadTask[]> =>
    ipcRenderer.invoke('download:recover'),

  // File
  fileExists: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    ipcRenderer.invoke('file:exists', { filepath }),
  deleteFile: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    ipcRenderer.invoke('file:delete', { filepath }),
  showItemInFolder: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    ipcRenderer.invoke('file:showInFolder', { filepath }),

  // Dialog
  selectSavePath: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:select-path'),
  selectFilePath: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:select-file'),
  openFileInFolder: (filepath: string): Promise<import('../shared/types').OpenPathResult> =>
    ipcRenderer.invoke('dialog:open-file', { filepath }),
  resolvePath: (filepath: string): Promise<import('../shared/types').ResolvePathResult> =>
    ipcRenderer.invoke('path:resolve', { filepath }),

  // FFmpeg
  convertVideo: (req: {
    inputPath: string
    outputDir?: string
    outputFormat: string
    outputFilename?: string
  }): Promise<string> => ipcRenderer.invoke('ffmpeg:convert', req),
  extractAudio: (req: {
    inputPath: string
    outputDir?: string
    outputFormat: string
    outputFilename?: string
  }): Promise<string> => ipcRenderer.invoke('ffmpeg:extract-audio', req),

  // History
  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:list'),
  addHistory: (entry: HistoryEntry): Promise<void> =>
    ipcRenderer.invoke('history:add', entry),
  deleteHistory: (id: string): Promise<void> =>
    ipcRenderer.invoke('history:delete', { id }),
  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('history:clear'),

  // Saved URLs
  getSavedUrls: (): Promise<SavedUrlEntry[]> =>
    ipcRenderer.invoke('saved-urls:list'),
  addSavedUrl: (entry: { url: string; title: string; thumbnail: string; uploader: string }): Promise<SavedUrlEntry> =>
    ipcRenderer.invoke('saved-urls:add', entry),
  deleteSavedUrl: (id: string): Promise<void> =>
    ipcRenderer.invoke('saved-urls:delete', { id }),
  deleteSavedUrlByUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('saved-urls:delete-by-url', { url }),

  // Bilibili
  generateBiliQr: (): Promise<import('../shared/types').BiliQrResult> =>
    ipcRenderer.invoke('bilibili:generate-qr'),
  pollBiliLogin: (qrcode_key: string): Promise<import('../shared/types').BiliPollResult> =>
    ipcRenderer.invoke('bilibili:poll-login', { qrcode_key }),
  getBiliState: (): Promise<import('../shared/types').BiliLoginState> =>
    ipcRenderer.invoke('bilibili:get-state'),
  clearBiliCookies: (): Promise<void> =>
    ipcRenderer.invoke('bilibili:clear-cookies'),
  checkBiliCookies: (): Promise<boolean> =>
    ipcRenderer.invoke('bilibili:check-cookies'),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', patch),
  testProxy: (proxy: string): Promise<import('../shared/types').ProxyTestResult> =>
    ipcRenderer.invoke('settings:test-proxy', { proxy }),
  setDeepseekKey: (profileId: string, key: string): Promise<AppSettings> =>
    ipcRenderer.invoke('translate:set-key', { profileId, key }),

  // Translation
  translateText: (req: TranslateRequest): Promise<TranslateResult> =>
    ipcRenderer.invoke('translate:request', req),
  testTranslateProfile: (req: import('../shared/types').TranslateTestRequest): Promise<import('../shared/types').TranslateTestResult> =>
    ipcRenderer.invoke('translate:test', req),

  // App
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:get-version'),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('app:open-external', { url }),
  checkVersions: (): Promise<import('../shared/types').VersionCheckResult> =>
    ipcRenderer.invoke('app:version-check'),

  // Event listeners (return unsubscribe function)
  onDownloadProgress: (cb: (data: ProgressPayload) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: ProgressPayload) => cb(data)
    ipcRenderer.on('download:progress', handler)
    return () => { ipcRenderer.removeListener('download:progress', handler) }
  },
  onDownloadComplete: (cb: (data: CompletePayload) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: CompletePayload) => cb(data)
    ipcRenderer.on('download:complete', handler)
    return () => { ipcRenderer.removeListener('download:complete', handler) }
  },
  onDownloadError: (cb: (data: ErrorPayload) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: ErrorPayload) => cb(data)
    ipcRenderer.on('download:error', handler)
    return () => { ipcRenderer.removeListener('download:error', handler) }
  },
  onFfmpegProgress: (cb: (data: { taskId: string; percentage: number }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; percentage: number }) => cb(data)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:progress', handler) }
  },
  onFfmpegComplete: (cb: (data: { taskId: string; outputPath: string }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; outputPath: string }) => cb(data)
    ipcRenderer.on('ffmpeg:complete', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:complete', handler) }
  },
  onFfmpegError: (cb: (data: { taskId: string; error: string }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; error: string }) => cb(data)
    ipcRenderer.on('ffmpeg:error', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:error', handler) }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ClipPickApi = typeof api
