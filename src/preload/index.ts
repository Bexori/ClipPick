import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  StartDownloadRequest, HistoryEntry, ProgressPayload,
  CompletePayload, ErrorPayload, FfmpegRequest, VideoParseResult, AppSettings,
  TranslateRequest, TranslateResult, SavedUrlEntry, PlaylistParseResult
} from '../shared/types'

function normalizeIpcError(error: unknown, fallback = '请求失败'): Error {
  const raw = error instanceof Error ? error.message : String(error || '')
  const message = raw.replace(/^Error invoking remote method '[^']+':\s*/i, '').trim()
  return new Error(message || fallback)
}

function invokeSafe<T>(channel: string, payload?: unknown, fallback?: string): Promise<T> {
  return ipcRenderer.invoke(channel, payload).catch(error => {
    throw normalizeIpcError(error, fallback)
  })
}

const api = {
  parseVideo: (url: string): Promise<VideoParseResult> =>
    invokeSafe('yt-dlp:parse-url', { url }, '解析失败'),
  parsePlaylist: (url: string): Promise<PlaylistParseResult> =>
    invokeSafe('yt-dlp:parse-playlist', { url }, '解析失败'),

  startDownload: (opts: StartDownloadRequest): Promise<string> =>
    invokeSafe('download:start', opts, '下载任务创建失败'),
  cancelDownload: (taskId: string): Promise<boolean> =>
    invokeSafe('download:cancel', { taskId }, '取消下载失败'),
  recoverUnfinished: (): Promise<import('../shared/types').DownloadTask[]> =>
    invokeSafe('download:recover', undefined, '恢复下载失败'),

  fileExists: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    invokeSafe('file:exists', { filepath }, '文件检查失败'),
  deleteFile: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    invokeSafe('file:delete', { filepath }, '删除文件失败'),
  showItemInFolder: (filepath: string): Promise<import('../shared/types').FileOpResult> =>
    invokeSafe('file:showInFolder', { filepath }, '打开文件位置失败'),

  selectSavePath: (): Promise<string | null> =>
    invokeSafe('dialog:select-path', undefined, '选择目录失败'),
  selectFilePath: (): Promise<string | null> =>
    invokeSafe('dialog:select-file', undefined, '选择文件失败'),
  openFileInFolder: (filepath: string): Promise<import('../shared/types').OpenPathResult> =>
    invokeSafe('dialog:open-file', { filepath }, '打开文件失败'),
  resolvePath: (filepath: string): Promise<import('../shared/types').ResolvePathResult> =>
    invokeSafe('path:resolve', { filepath }, '路径解析失败'),

  convertVideo: (req: {
    inputPath: string
    outputDir?: string
    outputFormat: string
    outputFilename?: string
  }): Promise<string> => invokeSafe('ffmpeg:convert', req, '视频转换失败'),
  extractAudio: (req: {
    inputPath: string
    outputDir?: string
    outputFormat: string
    outputFilename?: string
  }): Promise<string> => invokeSafe('ffmpeg:extract-audio', req, '音频提取失败'),

  getHistory: (): Promise<HistoryEntry[]> =>
    invokeSafe('history:list', undefined, '读取历史失败'),
  addHistory: (entry: HistoryEntry): Promise<void> =>
    invokeSafe('history:add', entry, '写入历史失败'),
  renameHistory: (id: string, name: string): Promise<HistoryEntry> =>
    invokeSafe('history:rename', { id, name }, '重命名文件失败'),
  deleteHistory: (id: string): Promise<void> =>
    invokeSafe('history:delete', { id }, '删除历史失败'),
  clearHistory: (): Promise<void> =>
    invokeSafe('history:clear', undefined, '清空历史失败'),

  getSavedUrls: (): Promise<SavedUrlEntry[]> =>
    invokeSafe('saved-urls:list', undefined, '读取收藏失败'),
  addSavedUrl: (entry: { url: string; title: string; thumbnail: string; uploader: string }): Promise<SavedUrlEntry> =>
    invokeSafe('saved-urls:add', entry, '添加收藏失败'),
  deleteSavedUrl: (id: string): Promise<void> =>
    invokeSafe('saved-urls:delete', { id }, '删除收藏失败'),
  deleteSavedUrlByUrl: (url: string): Promise<boolean> =>
    invokeSafe('saved-urls:delete-by-url', { url }, '取消收藏失败'),

  generateBiliQr: (): Promise<import('../shared/types').BiliQrResult> =>
    invokeSafe('bilibili:generate-qr', undefined, '二维码生成失败'),
  pollBiliLogin: (qrcode_key: string): Promise<import('../shared/types').BiliPollResult> =>
    invokeSafe('bilibili:poll-login', { qrcode_key }, '登录状态检查失败'),
  getBiliState: (): Promise<import('../shared/types').BiliLoginState> =>
    invokeSafe('bilibili:get-state', undefined, '读取登录状态失败'),
  clearBiliCookies: (): Promise<void> =>
    invokeSafe('bilibili:clear-cookies', undefined, '退出登录失败'),
  checkBiliCookies: (): Promise<boolean> =>
    invokeSafe('bilibili:check-cookies', undefined, 'Cookie 检查失败'),

  getSettings: (): Promise<AppSettings> =>
    invokeSafe('settings:get', undefined, '读取设置失败'),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    invokeSafe('settings:update', patch, '保存设置失败'),
  testProxy: (proxy: string): Promise<import('../shared/types').ProxyTestResult> =>
    invokeSafe('settings:test-proxy', { proxy }, '代理测试失败'),
  setDeepseekKey: (profileId: string, key: string): Promise<AppSettings> =>
    invokeSafe('translate:set-key', { profileId, key }, '保存 API Key 失败'),

  translateText: (req: TranslateRequest): Promise<TranslateResult> =>
    invokeSafe('translate:request', req, '翻译失败'),
  testTranslateProfile: (req: import('../shared/types').TranslateTestRequest): Promise<import('../shared/types').TranslateTestResult> =>
    invokeSafe('translate:test', req, '翻译连接测试失败'),

  getAppVersion: (): Promise<string> =>
    invokeSafe('app:get-version', undefined, '读取版本失败'),
  openExternal: (url: string): Promise<void> =>
    invokeSafe('app:open-external', { url }, '打开链接失败'),
  checkVersions: (): Promise<import('../shared/types').VersionCheckResult> =>
    invokeSafe('app:version-check', undefined, '检查版本失败'),

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
