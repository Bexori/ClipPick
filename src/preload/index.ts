import { contextBridge, ipcRenderer } from 'electron'
import type {
  StartDownloadRequest, HistoryEntry, ProgressPayload,
  CompletePayload, ErrorPayload, FfmpegRequest, VideoParseResult, AppSettings
} from '../shared/types'

const api = {
  // Video parsing
  parseVideo: (url: string): Promise<VideoParseResult> =>
    ipcRenderer.invoke('yt-dlp:parse-url', { url }),

  // Download
  startDownload: (opts: StartDownloadRequest): Promise<string> =>
    ipcRenderer.invoke('download:start', opts),
  cancelDownload: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('download:cancel', { taskId }),

  // Dialog
  selectSavePath: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:select-path'),
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

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', patch),

  // App
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:get-version'),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('app:open-external', { url }),

  // Event listeners (return unsubscribe function)
  onDownloadProgress: (cb: (data: ProgressPayload) => void): (() => void) => {
    const handler = (_event: any, data: ProgressPayload) => cb(data)
    ipcRenderer.on('download:progress', handler)
    return () => { ipcRenderer.removeListener('download:progress', handler) }
  },
  onDownloadComplete: (cb: (data: CompletePayload) => void): (() => void) => {
    const handler = (_event: any, data: CompletePayload) => cb(data)
    ipcRenderer.on('download:complete', handler)
    return () => { ipcRenderer.removeListener('download:complete', handler) }
  },
  onDownloadError: (cb: (data: ErrorPayload) => void): (() => void) => {
    const handler = (_event: any, data: ErrorPayload) => cb(data)
    ipcRenderer.on('download:error', handler)
    return () => { ipcRenderer.removeListener('download:error', handler) }
  },
  onFfmpegProgress: (cb: (data: { taskId: string; percentage: number }) => void): (() => void) => {
    const handler = (_event: any, data: { taskId: string; percentage: number }) => cb(data)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:progress', handler) }
  },
  onFfmpegComplete: (cb: (data: { taskId: string; outputPath: string }) => void): (() => void) => {
    const handler = (_event: any, data: { taskId: string; outputPath: string }) => cb(data)
    ipcRenderer.on('ffmpeg:complete', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:complete', handler) }
  },
  onFfmpegError: (cb: (data: { taskId: string; error: string }) => void): (() => void) => {
    const handler = (_event: any, data: { taskId: string; error: string }) => cb(data)
    ipcRenderer.on('ffmpeg:error', handler)
    return () => { ipcRenderer.removeListener('ffmpeg:error', handler) }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type VideoBoxApi = typeof api
