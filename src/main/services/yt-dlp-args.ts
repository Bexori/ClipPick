import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { AppSettings, CookieBrowser } from '../../shared/types'
import { defaultSettings } from './settings.service'

type SiteKind = 'bilibili' | 'tiktok' | 'douyin' | 'youtube' | 'generic'

interface Attempt {
  label: string
  args: string[]
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'

function getDenoPath(): string | null {
  const candidates = [
    path.join(__dirname, '../../../resources/deno.exe'),
    path.join(process.cwd(), 'resources/deno.exe'),
    path.join(process.resourcesPath || '', 'deno.exe')
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

  if (site === 'douyin') {
    const common = buildCommonArgs(cleanUrl, settings)
    const filtered = common.filter((a, i, arr) => {
      if (a === '--extractor-args' && arr[i + 1]?.includes('player_client')) return false
      if (a.includes('player_client')) return false
      return true
    })
    attempts.push({
      label: 'douyin:mobile',
      args: [
        ...filtered,
        '--extractor-args',
        'douyin:player_client=android;download=True'
      ]
    })
  }

  return attempts.map((attempt) => ({
    label: attempt.label,
    args: ['-J', '--no-download', '--no-playlist', ...attempt.args, cleanUrl]
  }))
}

export function buildDownloadArgs(
  url: string,
  formatId: string,
  outputTemplate: string,
  ffmpegPath: string,
  settings: AppSettings = defaultSettings
): string[] {
  const downloadSettings: AppSettings = settings.cookieMode === 'auto'
    ? { ...settings, cookieMode: 'none' }
    : settings

  const args = [
    url,
    '-f', formatId || 'bestvideo+bestaudio/best',
    '-o', outputTemplate,
    '--newline',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    ...buildAttempts(url, downloadSettings)[0].args
  ]

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath)
  }

  return args
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

function buildCommonArgs(url: string, settings: AppSettings): string[] {
  const site = detectSite(url)
  const args = [
    '--no-check-certificates',
    '--geo-bypass',
    '--extractor-retries', '3',
    '--fragment-retries', '10'
  ]

  if (site === 'bilibili') {
    args.push(
      '--user-agent', DESKTOP_UA,
      '--add-header', 'Referer:https://www.bilibili.com/',
      '--add-header', 'Origin:https://www.bilibili.com'
    )
  } else if (site === 'tiktok') {
    args.push(
      '--user-agent', DESKTOP_UA,
      '--add-header', 'Referer:https://www.tiktok.com/',
      '--add-header', 'Origin:https://www.tiktok.com'
    )
  } else if (site === 'douyin') {
    args.push(
      '--user-agent', MOBILE_UA,
      '--add-header', 'Referer:https://www.douyin.com/',
      '--add-header', 'Origin:https://www.douyin.com',
      '--extractor-args', 'douyin:player_client=android'
    )
  } else if (site === 'youtube') {
    args.push(
      '--user-agent', DESKTOP_UA,
      '--add-header', 'Referer:https://www.youtube.com/',
      '--add-header', 'Origin:https://www.youtube.com'
    )
    const denoPath = getDenoPath()
    if (denoPath) {
      args.push('--extractor-args', `youtube:js_runtime=${denoPath.replace(/\\/g, '/')}`)
    }
  } else {
    args.push('--user-agent', DESKTOP_UA)
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
