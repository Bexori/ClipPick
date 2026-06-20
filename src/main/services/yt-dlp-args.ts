import { app } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { AppSettings, CookieBrowser } from '../../shared/types'
import { defaultSettings } from './settings.service'

type SiteKind = 'bilibili' | 'tiktok' | 'douyin' | 'youtube' | 'instagram' | 'generic'

interface Attempt {
  label: string
  args: string[]
}

interface SiteStrategy {
  userAgent: string
  headers?: string[]
  extractorArgs?: (settings: AppSettings) => string[]
  cookies?: () => string[]
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'

const SITE_STRATEGIES: Record<SiteKind, SiteStrategy> = {
  bilibili: {
    userAgent: DESKTOP_UA,
    headers: ['Referer:https://www.bilibili.com/', 'Origin:https://www.bilibili.com'],
    cookies: () => {
      const biliCookiePath = getBiliCookiePath()
      return biliCookiePath && fs.existsSync(biliCookiePath) ? ['--cookies', biliCookiePath] : []
    }
  },
  tiktok: {
    userAgent: DESKTOP_UA,
    headers: ['Referer:https://www.tiktok.com/', 'Origin:https://www.tiktok.com']
  },
  douyin: {
    userAgent: MOBILE_UA,
    headers: ['Referer:https://www.douyin.com/', 'Origin:https://www.douyin.com'],
    extractorArgs: () => ['douyin:player_client=android'],
    cookies: () => {
      const douyinCookiePath = getDouyinCookiePath()
      return douyinCookiePath && fs.existsSync(douyinCookiePath) ? ['--cookies', douyinCookiePath] : []
    }
  },
  youtube: {
    userAgent: DESKTOP_UA,
    headers: ['Referer:https://www.youtube.com/', 'Origin:https://www.youtube.com'],
    extractorArgs: () => {
      const denoPath = getDenoPath()
      return denoPath ? [`youtube:js_runtime=${denoPath.replace(/\\/g, '/')}`] : []
    }
  },
  instagram: {
    userAgent: DESKTOP_UA,
    headers: ['Referer:https://www.instagram.com/', 'Origin:https://www.instagram.com']
  },
  generic: {
    userAgent: DESKTOP_UA
  }
}

function getDenoPath(): string | null {
  const isDev = !app.isPackaged
  const candidates = isDev
    ? [
        path.join(__dirname, '../../../resources/deno.exe'),
        path.join(process.cwd(), 'resources/deno.exe')
      ]
    : [
        path.join(process.resourcesPath, 'deno.exe'),
        path.join(process.resourcesPath, 'resources/deno.exe')
      ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s，,]+/)
  return match ? match[0].replace(/[，。,\.]+$/, '') : text.trim().split(/\s+/)[0]
}

export function buildParseAttempts(url: string, settings: AppSettings = defaultSettings): Attempt[] {
  const cleanUrl = extractUrl(url)
  const attempts = buildAttempts(cleanUrl, settings)
  const site = detectSite(cleanUrl)

  if (site === 'youtube') {
    const common = buildCommonArgs(cleanUrl, settings)
    attempts.push({
      label: 'youtube:mweb-web',
      args: [
        ...common,
        '--extractor-args',
        'youtube:player_client=mweb,web'
      ]
    })
  }

  if (site === 'instagram') {
    const common = buildCommonArgs(cleanUrl, settings)
    attempts.push({
      label: 'instagram:web',
      args: [
        ...common,
        '--extractor-retries', '5',
        '--fragment-retries', '20'
      ]
    })
  }

  if (site === 'douyin') {
    const common = buildCommonArgs(cleanUrl, settings)

    // Filter out any existing player_client extractor args
    const noExtractorArgs = common.filter((a, i, arr) => {
      if (a === '--extractor-args' && arr[i + 1]?.includes('player_client')) return false
      if (a.includes('player_client')) return false
      return true
    })

    // Also filter out cookie args for attempts that don't need them
    const noCookies = noExtractorArgs.filter((a, i, arr) => {
      if (a === '--cookies' && arr[i + 1]?.endsWith('cookies.txt')) return false
      if (i > 0 && arr[i - 1] === '--cookies' && a.endsWith('cookies.txt')) return false
      return true
    })

    // Attempt 2: mobile client with download flag
    attempts.push({
      label: 'douyin:mobile',
      args: [
        ...noCookies,
        '--extractor-args',
        'douyin:player_client=android;download=True'
      ]
    })

    // Attempt 3: web client (douyin web version)
    attempts.push({
      label: 'douyin:web',
      args: [
        ...noCookies,
        '--extractor-args',
        'douyin:player_client=web;download=True'
      ]
    })

    // Attempt 4: bare minimum — no cookies, no extractor args, no headers beyond UA
    attempts.push({
      label: 'douyin:fallback',
      args: [
        '--no-check-certificates',
        '--geo-bypass',
        '--extractor-retries', '5',
        '--fragment-retries', '20',
        '--user-agent', MOBILE_UA
      ]
    })
  }

  return attempts.map((attempt) => ({
    label: attempt.label,
    args: ['-J', '--no-download', '--no-playlist', ...attempt.args, cleanUrl]
  }))
}

export interface SubtitleOptions {
  writeSubs?: boolean
  writeAutoSubs?: boolean
  subLangs?: string
  embedSubs?: boolean
}

export function buildDownloadArgs(
  url: string,
  formatId: string,
  outputTemplate: string,
  ffmpegPath: string,
  settings: AppSettings = defaultSettings,
  subs?: SubtitleOptions
): string[] {
  const args = [
    '--no-check-certificates',
    '--geo-bypass',
    '--extractor-retries', '3',
    '--fragment-retries', '10',
    '--user-agent', SITE_STRATEGIES[detectSite(url)].userAgent,
    ...buildDownloadCookieArgs(url, settings),
    ...(SITE_STRATEGIES[detectSite(url)].headers ?? []).flatMap(header => ['--add-header', header]),
    ...(SITE_STRATEGIES[detectSite(url)].extractorArgs?.(settings) ?? []).flatMap(arg => ['--extractor-args', arg]),
    ...(settings.proxy.trim() ? ['--proxy', settings.proxy.trim()] : []),
    url,
    '-f', formatId || 'bestvideo+bestaudio/best',
    '-o', outputTemplate,
    '--newline',
    '--merge-output-format', 'mp4',
    '--no-playlist'
  ]

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath)
  }

  if (subs?.writeSubs) args.push('--write-subs')
  if (subs?.writeAutoSubs) args.push('--write-auto-subs')
  if (subs?.subLangs) args.push('--sub-langs', subs.subLangs)
  if (subs?.embedSubs) args.push('--embed-subs')

  return args
}

function buildDownloadCookieArgs(url: string, settings: AppSettings): string[] {
  const site = detectSite(url)
  const cookieMode = settings.cookieMode

  if (cookieMode === 'file' && settings.cookiesFile.trim()) {
    return ['--cookies', settings.cookiesFile.trim()]
  }

  if (cookieMode === 'browser') {
    const browser = getCookieBrowserCandidates(settings)[0]
    return browser ? ['--cookies-from-browser', browser] : []
  }

  if (site === 'bilibili') {
    const biliCookiePath = getBiliCookiePath()
    return biliCookiePath && fs.existsSync(biliCookiePath) ? ['--cookies', biliCookiePath] : []
  }

  if (site === 'douyin') {
    const douyinCookiePath = getDouyinCookiePath()
    return douyinCookiePath && fs.existsSync(douyinCookiePath) ? ['--cookies', douyinCookiePath] : []
  }

  return []
}

function buildAttempts(url: string, settings: AppSettings): Attempt[] {
  const common = buildCommonArgs(url, settings)
  const site = detectSite(url)
  const cookieMode = settings.cookieMode
  const browserArgs = cookieMode === 'browser'
    ? getCookieBrowserCandidates(settings).map((browser) => ({
      label: `cookies:${browser}`,
      args: [...common, '--cookies-from-browser', browser]
    }))
    : []
  const fileArgs = cookieMode === 'file' && settings.cookiesFile.trim()
    ? [{
      label: 'cookies:file',
      args: [...common, '--cookies', settings.cookiesFile.trim()]
    }]
    : []
  const noCookieFallback = cookieMode === 'file'
    ? []
    : [{ label: 'no-cookies', args: common }]

  if (site === 'generic' && cookieMode === 'auto') {
    return [{ label: 'no-cookies', args: common }]
  }

  const attempts = [
    ...fileArgs,
    ...browserArgs,
    ...noCookieFallback
  ]

  return attempts.length > 0 ? attempts : [{ label: 'no-cookies', args: common }]
}

export function buildCommonArgsForUrl(url: string, settings: AppSettings = defaultSettings): string[] {
  return buildCommonArgs(url, settings)
}

function buildCommonArgs(url: string, settings: AppSettings): string[] {
  const site = detectSite(url)
  const strategy = SITE_STRATEGIES[site]
  const args = [
    '--no-check-certificates',
    '--geo-bypass',
    '--extractor-retries', '3',
    '--fragment-retries', '10',
    '--user-agent', strategy.userAgent
  ]

  for (const header of strategy.headers ?? []) {
    args.push('--add-header', header)
  }

  const extractorArgs = strategy.extractorArgs?.(settings) ?? []
  for (const extractorArg of extractorArgs) {
    args.push('--extractor-args', extractorArg)
  }

  const cookieArgs = strategy.cookies?.() ?? []
  if (cookieArgs.length > 0) {
    args.push(...cookieArgs)
  }

  if (settings.proxy.trim()) {
    args.push('--proxy', settings.proxy.trim())
  }

  return args
}

function detectSite(url: string): SiteKind {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes('bilibili.com') || hostname === 'b23.tv') return 'bilibili'
    if (hostname.includes('youtube.com') || hostname === 'youtu.be') return 'youtube'
    if (hostname.includes('tiktok.com')) return 'tiktok'
    if (
      hostname.includes('douyin.com') ||
      hostname.includes('iesdouyin.com') ||
      hostname === 'v.douyin.com'
    ) {
      return 'douyin'
    }
  } catch {
    return 'generic'
  }

  return 'generic'
}

function getCookieBrowserCandidates(settings: AppSettings): CookieBrowser[] {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return []

  const candidates: Array<[string, string]> = [
    ['edge', path.join(localAppData, 'Microsoft', 'Edge', 'User Data')],
    ['chrome', path.join(localAppData, 'Google', 'Chrome', 'User Data')],
    ['brave', path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['vivaldi', path.join(localAppData, 'Vivaldi', 'User Data')]
  ]

  if (os.platform() !== 'win32') return []

  if (settings.cookieMode === 'browser') {
    if (settings.cookieBrowser === 'chrome') return []
    const selected = candidates.find(([browser]) => browser === settings.cookieBrowser)
    return selected && fs.existsSync(selected[1]) ? [selected[0] as CookieBrowser] : []
  }

  return candidates
    .filter(([, profileDir]) => fs.existsSync(profileDir))
    .map(([browser]) => browser as CookieBrowser)
}

function getBiliCookiePath(): string | null {
  try {
    return path.join(app.getPath('userData'), 'bilibili-cookies.txt')
  } catch {
    return null
  }
}

function getDouyinCookiePath(): string | null {
  try {
    return path.join(app.getPath('userData'), 'douyin-cookies.txt')
  } catch {
    return null
  }
}
