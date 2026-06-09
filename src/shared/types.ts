// ============ IPC 通道常量 ============

export const IpcChannels = {
  // yt-dlp
  YTDLP_PARSE_URL: 'yt-dlp:parse-url',
  YTDLP_GET_VERSION: 'yt-dlp:get-version',

  // Download
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // Dialog
  DIALOG_SELECT_PATH: 'dialog:select-path',
  DIALOG_OPEN_FILE: 'dialog:open-file',

  // FFmpeg
  FFMPEG_CONVERT: 'ffmpeg:convert',
  FFMPEG_EXTRACT_AUDIO: 'ffmpeg:extract-audio',
  FFMPEG_PROGRESS: 'ffmpeg:progress',
  FFMPEG_COMPLETE: 'ffmpeg:complete',
  FFMPEG_ERROR: 'ffmpeg:error',

  // History
  HISTORY_LIST: 'history:list',
  HISTORY_ADD: 'history:add',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_OPEN_EXTERNAL: 'app:open-external'
} as const

// ============ 视频解析 ============

export interface VideoFormat {
  formatId: string
  ext: string
  resolution: string
  filesize: number
  filesizeText: string
  videoCodec: string
  audioCodec: string
  videoBitrate: number
  audioBitrate: number
  fps: number
  hasVideo: boolean
  hasAudio: boolean
  height: number
  note: string
}

export interface VideoParseResult {
  id: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  uploaderUrl: string
  description: string
  webpageUrl: string
  formats: VideoFormat[]
}

// ============ 下载 ============

export interface StartDownloadRequest {
  url: string
  formatId: string
  outputDir: string
  filename: string
}

export type DownloadStatus =
  | 'queued' | 'downloading' | 'post-processing'
  | 'completed' | 'cancelled' | 'error'

export interface DownloadTask {
  taskId: string
  videoId: string
  title: string
  thumbnail: string
  url: string
  formatLabel: string
  outputDir: string
  filename: string
  status: DownloadStatus
  progress: number
  speed: string
  eta: string
  downloadedBytes: number
  totalBytes: number
  error?: string
  createdAt: string
  completedAt?: string
}

export interface ProgressPayload {
  taskId: string
  percentage: number
  speed: string
  eta: string
  downloadedBytes: number
  totalBytes: number
  status: 'downloading' | 'post-processing'
}

export interface CompletePayload {
  taskId: string
  filepath: string
  filesize: number
}

export interface ErrorPayload {
  taskId: string
  error: string
}

// ============ 历史记录 ============

export interface HistoryEntry {
  id: string
  videoId: string
  title: string
  thumbnail: string
  url: string
  formatLabel: string
  filepath: string
  filesize: number
  duration: number
  status: 'completed' | 'cancelled' | 'error'
  downloadedAt: string
  errorMessage?: string
}

// ============ FFmpeg ============

export interface FfmpegRequest {
  inputPath: string
  outputDir?: string
  outputFormat: string
  outputFilename?: string
}

export interface FfmpegTask {
  taskId: string
  inputPath: string
  outputPath: string
  type: 'convert' | 'extract-audio'
  progress: number
  status: 'running' | 'completed' | 'error'
  error?: string
}
