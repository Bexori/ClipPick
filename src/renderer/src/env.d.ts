/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface VideoBoxApi {
  parseVideo(url: string): Promise<import('../../shared/types').VideoParseResult>
  startDownload(opts: import('../../shared/types').StartDownloadRequest): Promise<string>
  cancelDownload(taskId: string): Promise<boolean>
  selectSavePath(): Promise<string | null>
  openFileInFolder(filepath: string): Promise<import('../../shared/types').OpenPathResult>
  resolvePath(filepath: string): Promise<import('../../shared/types').ResolvePathResult>
  convertVideo(req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }): Promise<string>
  extractAudio(req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string }): Promise<string>
  getHistory(): Promise<import('../../shared/types').HistoryEntry[]>
  addHistory(entry: import('../../shared/types').HistoryEntry): Promise<void>
  deleteHistory(id: string): Promise<void>
  clearHistory(): Promise<void>
  getSettings(): Promise<import('../../shared/types').AppSettings>
  updateSettings(patch: Partial<import('../../shared/types').AppSettings>): Promise<import('../../shared/types').AppSettings>
  getAppVersion(): Promise<string>
  openExternal(url: string): Promise<void>
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
