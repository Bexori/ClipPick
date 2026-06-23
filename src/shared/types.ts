// ============ IPC 通道常量 ============

export const IpcChannels = {
  // yt-dlp
  YTDLP_PARSE_URL: 'yt-dlp:parse-url',
  YTDLP_PARSE_PLAYLIST: 'yt-dlp:parse-playlist',
  YTDLP_GET_VERSION: 'yt-dlp:get-version',

  // Download
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // Dialog
  DIALOG_SELECT_PATH: 'dialog:select-path',
  DIALOG_SELECT_FILE: 'dialog:select-file',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  PATH_RESOLVE: 'path:resolve',

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

  // Saved URLs
  SAVED_URLS_LIST: 'saved-urls:list',
  SAVED_URLS_ADD: 'saved-urls:add',
  SAVED_URLS_DELETE: 'saved-urls:delete',
  SAVED_URLS_DELETE_BY_URL: 'saved-urls:delete-by-url',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_TEST_PROXY: 'settings:test-proxy',

  // File
  FILE_EXISTS: 'file:exists',
  FILE_DELETE: 'file:delete',
  FILE_SHOW_IN_FOLDER: 'file:showInFolder',

  // Bilibili
  BILIBILI_GENERATE_QR: 'bilibili:generate-qr',
  BILIBILI_POLL_LOGIN: 'bilibili:poll-login',
  BILIBILI_GET_STATE: 'bilibili:get-state',
  BILIBILI_CLEAR_COOKIES: 'bilibili:clear-cookies',
  BILIBILI_CHECK_COOKIES: 'bilibili:check-cookies',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_OPEN_EXTERNAL: 'app:open-external',

  // Version check
  VERSION_CHECK: 'app:version-check',

  // Download recovery
  DOWNLOAD_RECOVER: 'download:recover',

  // Translation
  TRANSLATE: 'translate:request',
  TRANSLATE_SET_KEY: 'translate:set-key',
  TRANSLATE_TEST: 'translate:test'
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

export interface SubtitleInfo {
  lang: string
  label: string
  kind: 'manual' | 'auto'
  embeddable: boolean
}

export interface PlaylistEntry {
  id: string
  title: string
  url: string
  duration: number
  thumbnail: string
  uploader: string
  index: number
}

export interface PlaylistParseResult {
  id: string
  title: string
  uploader: string
  entryCount: number
  entries: PlaylistEntry[]
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
  subtitles: SubtitleInfo[]
}

// ============ 下载 ============

export interface StartDownloadRequest {
  url: string
  formatId: string
  outputDir: string
  filename: string
  formatLabel?: string
  writeSubs?: boolean
  writeAutoSubs?: boolean
  subLangs?: string
  embedSubs?: boolean
}

export type CookieMode = 'auto' | 'browser' | 'file' | 'none'
export type CookieBrowser = 'edge' | 'chrome' | 'firefox' | 'custom'
export type AppLanguage = 'system' | 'zh-CN' | 'en' | 'ja'
export type ThemeMode = 'system' | 'light' | 'dark'
export type DensityMode = 'comfortable' | 'standard' | 'compact'
export type AccentColor = string

export interface AppSettings {
  defaultSavePath: string
  concurrentDownloads: number
  cookieMode: CookieMode
  cookieBrowser: CookieBrowser
  cookiesFile: string
  biliCookieHours: number
  proxy: string
  downloadNotifications: boolean
  notificationMode: 'system' | 'in-app' | 'both'
  autoRetryCount: number
  appLanguage: AppLanguage
  themeMode: ThemeMode
  density: DensityMode
  accentColor: AccentColor
  translateProfiles: TranslateProfile[]
  activeProfileId: string
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
  formatId: string
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
  errorDetail?: string
  retryCount?: number
  maxRetries?: number
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
  subtitleFiles?: string[]
  subtitleStatus?: 'none' | 'external' | 'embedded' | 'embed-failed'
}

export interface ErrorPayload {
  taskId: string
  error: string
  detail?: string
}

export interface BiliQrResult {
  qrcode_key: string
  qrUrl: string
}

export interface BiliPollResult {
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired'
  message: string
  nickname?: string
  cookiesPath?: string
}

export interface BiliLoginState {
  loggedIn: boolean
  expired: boolean
  nickname?: string
  cookiesPath?: string
  expiresAt?: string
  expiresInSeconds?: number
  expiresInText?: string
}

export interface FileOpResult {
  ok: boolean
  message?: string
}

export interface OpenPathResult {
  ok: boolean
  message?: string
}

export interface ResolvePathResult {
  ok: boolean
  inputPath: string
  resolvedPath: string
  displayName: string
  parentDir: string
  message?: string
}

export interface ProxyTestResult {
  ok: boolean
  message: string
  latencyMs?: number
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
  subtitleFiles?: string[]
  subtitleStatus?: 'none' | 'external' | 'embedded' | 'embed-failed'
  errorMessage?: string
}

// ============ Saved URLs (Bookmarks) ============

export interface SavedUrlEntry {
  id: string
  url: string
  title: string
  thumbnail: string
  uploader: string
  savedAt: string
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

export interface VersionCheckResult {
  ytDlp: { current: string; latest: string; outdated: boolean }
  ffmpeg: { current: string; latest: string; outdated: boolean }
}

// ============ 翻译 ============

export interface TranslateProfile {
  id: string
  name: string
  endpoint: string
  model: string
  hasKey: boolean
}

export interface TranslateRequest {
  text: string
  profileId?: string
}

export interface TranslateResult {
  translatedText: string
}

export interface TranslateTestRequest {
  endpoint: string
  model: string
  apiKey: string
}

export interface TranslateTestResult {
  ok: boolean
  message: string
}
