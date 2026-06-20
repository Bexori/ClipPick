/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface VideoBoxApi {
  parseVideo(url: string): Promise<import('../../shared/types').VideoParseResult>
  parsePlaylist(url: string): Promise<import('../../shared/types').PlaylistParseResult>
  startDownload(opts: import('../../shared/types').StartDownloadRequest): Promise<string>
  cancelDownload(taskId: string): Promise<boolean>
  recoverUnfinished(): Promise<import('../../shared/types').DownloadTask[]>
  selectSavePath(): Promise<string | null>
  selectFilePath(): Promise<string | null>
  openFileInFolder(filepath: string): Promise<import('../../shared/types').OpenPathResult>
  resolvePath(filepath: string): Promise<import('../../shared/types').ResolvePathResult>
  fileExists(filepath: string): Promise<import('../../shared/types').FileOpResult>
  deleteFile(filepath: string): Promise<import('../../shared/types').FileOpResult>
  showItemInFolder(filepath: string): Promise<import('../../shared/types').FileOpResult>
  convertVideo(req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }): Promise<string>
  extractAudio(req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }): Promise<string>
  getHistory(): Promise<import('../../shared/types').HistoryEntry[]>
  addHistory(entry: import('../../shared/types').HistoryEntry): Promise<void>
  deleteHistory(id: string): Promise<void>
  clearHistory(): Promise<void>
  getSavedUrls(): Promise<import('../../shared/types').SavedUrlEntry[]>
  addSavedUrl(entry: { url: string; title: string; thumbnail: string; uploader: string }): Promise<import('../../shared/types').SavedUrlEntry>
  deleteSavedUrl(id: string): Promise<void>
  deleteSavedUrlByUrl(url: string): Promise<boolean>
  generateBiliQr(): Promise<import('../../shared/types').BiliQrResult>
  pollBiliLogin(qrcode_key: string): Promise<import('../../shared/types').BiliPollResult>
  getBiliState(): Promise<import('../../shared/types').BiliLoginState>
  clearBiliCookies(): Promise<void>
  checkBiliCookies(): Promise<boolean>
  getSettings(): Promise<import('../../shared/types').AppSettings>
  updateSettings(patch: Partial<import('../../shared/types').AppSettings>): Promise<import('../../shared/types').AppSettings>
  testProxy(proxy: string): Promise<import('../../shared/types').ProxyTestResult>
  setDeepseekKey(profileId: string, key: string): Promise<import('../../shared/types').AppSettings>
  translateText(req: import('../../shared/types').TranslateRequest): Promise<import('../../shared/types').TranslateResult>
  testTranslateProfile(req: import('../../shared/types').TranslateTestRequest): Promise<import('../../shared/types').TranslateTestResult>
  getAppVersion(): Promise<string>
  openExternal(url: string): Promise<void>
  checkVersions(): Promise<import('../../shared/types').VersionCheckResult>
  onDownloadProgress(cb: (data: import('../../shared/types').ProgressPayload) => void): () => void
  onDownloadComplete(cb: (data: import('../../shared/types').CompletePayload) => void): () => void
  onDownloadError(cb: (data: import('../../shared/types').ErrorPayload) => void): () => void
  onFfmpegProgress(cb: (data: { taskId: string; percentage: number }) => void): () => void
  onFfmpegComplete(cb: (data: { taskId: string; outputPath: string }) => void): () => void
  onFfmpegError(cb: (data: { taskId: string; error: string }) => void): () => void
}

interface Window {
  api: VideoBoxApi
}
