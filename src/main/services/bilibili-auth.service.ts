import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { SettingsService } from './settings.service'
import { logger } from '../utils/logger'

interface BiliLoginState {
  loggedIn: boolean
  expired: boolean
  nickname?: string
  cookiesPath?: string
  expiresAt?: string
  expiresInSeconds?: number
  expiresInText?: string
}

interface RawCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  expires: number
}

interface CookieFileMeta {
  nickname?: string
  expiresAt?: number
}

export class BilibiliAuthService {
  private settings: SettingsService

  constructor(settings: SettingsService) {
    this.settings = settings
  }

  private get cookiesPath(): string {
    return path.join(app.getPath('userData'), 'bilibili-cookies.txt')
  }

  async generateQrCode(): Promise<{ qrcode_key: string; qrUrl: string }> {
    try {
      const res = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const json = await res.json() as { code: number; data: { qrcode_key: string; url: string } }
      if (json.code !== 0 || !json.data) throw new Error('获取二维码失败')
      return { qrcode_key: json.data.qrcode_key, qrUrl: json.data.url }
    } catch (err) {
      logger.capture('bilibili generateQrCode failed', err)
      throw err
    }
  }

  async pollLogin(qrcode_key: string): Promise<{ status: string; message: string; nickname?: string; cookiesPath?: string }> {
    const res = await fetch(
      `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    )
    const json = await res.json() as {
      code: number
      data: { code: number; message: string; nickname?: string; refresh_token?: string }
    }
    if (json.code !== 0) throw new Error('轮询登录失败')

    const data = json.data
    if (data.code === 0) {
      const cookies = collectSetCookies(res)
      const cookiesFile = this.cookiesPath
      if (cookies.length > 0) {
        const expiresAt = resolveCookieExpiresAt(cookies, this.settings.get().biliCookieHours)
        fs.writeFileSync(
          cookiesFile,
          formatNetscapeCookies(cookies, {
            nickname: data.nickname,
            createdAt: Date.now(),
            expiresAt
          }),
          'utf-8'
        )
        logger.info('Bilibili login confirmed', { nickname: data.nickname, cookies: cookies.length, expiresAt })
        return { status: 'confirmed', message: '登录成功', nickname: data.nickname, cookiesPath: cookiesFile }
      }

      logger.warn('Bilibili login confirmed but no cookies were returned by the response')
      return {
        status: 'confirmed',
        message: '登录成功，但未获取到可供 yt-dlp 使用的 Cookie',
        nickname: data.nickname,
        cookiesPath: cookiesFile
      }
    }

    if (data.code === 86038) return { status: 'expired', message: '二维码已过期' }
    if (data.code === 86090) return { status: 'scanned', message: '已扫描，请在手机上确认' }
    if (data.code === 86101) return { status: 'waiting', message: '等待扫码' }
    return { status: 'waiting', message: data.message || '等待扫码' }
  }

  getState(): BiliLoginState {
    const cookiesFile = this.cookiesPath
    const exists = fs.existsSync(cookiesFile) && fs.statSync(cookiesFile).size > 0

    if (!exists) {
      return { loggedIn: false, expired: true, cookiesPath: cookiesFile }
    }

    const raw = safeReadFile(cookiesFile)
    const meta = parseCookieFileMeta(raw)
    const expiresAt = meta.expiresAt || readCookieExpiresAt(raw)
    const now = Date.now()
    const remainingSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0
    const expired = expiresAt ? expiresAt <= now : false

    return {
      loggedIn: true,
      expired,
      nickname: meta.nickname,
      cookiesPath: cookiesFile,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      expiresInSeconds: expiresAt ? remainingSeconds : undefined,
      expiresInText: expiresAt ? formatRemainingTime(remainingSeconds) : undefined
    }
  }

  clearCookies(): void {
    const p = this.cookiesPath
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  isCookieExpired(): boolean {
    return !(fs.existsSync(this.cookiesPath) && fs.statSync(this.cookiesPath).size > 0)
  }
}

function collectSetCookies(res: Response): RawCookie[] {
  const header = (res.headers as unknown as { getSetCookie?: () => string[]; get?: (name: string) => string | null })
  const rawHeaders = typeof header.getSetCookie === 'function'
    ? header.getSetCookie()
    : splitSetCookieHeader(header.get?.('set-cookie') || '')

  return rawHeaders.map(parseCookie).filter((cookie): cookie is RawCookie => Boolean(cookie))
}

function splitSetCookieHeader(input: string): string[] {
  if (!input) return []
  const parts: string[] = []
  let start = 0
  let inExpires = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const chunk = input.slice(Math.max(0, i - 8), i + 1).toLowerCase()
    if (chunk.endsWith('expires=')) inExpires = true
    if (inExpires && char === ';') inExpires = false
    if (!inExpires && char === ',') {
      parts.push(input.slice(start, i).trim())
      start = i + 1
    }
  }

  parts.push(input.slice(start).trim())
  return parts.filter(Boolean)
}

function parseCookie(line: string): RawCookie | null {
  const segments = line.split(';').map(part => part.trim()).filter(Boolean)
  const [nameValue, ...attrs] = segments
  if (!nameValue || !nameValue.includes('=')) return null

  const [name, ...valueParts] = nameValue.split('=')
  const value = valueParts.join('=')
  if (!name) return null

  let domain = '.bilibili.com'
  let cookiePath = '/'
  let secure = false
  let expires = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60

  for (const attr of attrs) {
    const [rawKey, ...rawValueParts] = attr.split('=')
    const key = rawKey.trim().toLowerCase()
    const rawValue = rawValueParts.join('=').trim()

    if (key === 'domain' && rawValue) domain = rawValue.startsWith('.') ? rawValue : `.${rawValue}`
    else if (key === 'path' && rawValue) cookiePath = rawValue
    else if (key === 'secure') secure = true
    else if (key === 'expires' && rawValue) {
      const ts = Date.parse(rawValue)
      if (Number.isFinite(ts)) expires = Math.floor(ts / 1000)
    } else if (key === 'max-age' && rawValue) {
      const seconds = Number.parseInt(rawValue, 10)
      if (Number.isFinite(seconds)) expires = Math.floor(Date.now() / 1000) + seconds
    }
  }

  return { name, value, domain, path: cookiePath, secure, expires }
}

function resolveCookieExpiresAt(cookies: RawCookie[], fallbackHours = 168): number {
  const candidates = cookies.map(cookie => cookie.expires).filter(exp => Number.isFinite(exp) && exp > 0)
  const localLimit = Date.now() + fallbackHours * 60 * 60 * 1000
  if (candidates.length > 0) {
    return Math.min(Math.min(...candidates) * 1000, localLimit)
  }
  return localLimit
}

function formatNetscapeCookies(cookies: RawCookie[], meta: CookieFileMeta = {}): string {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# Generated by VideoBox'
  ]

  if (meta.nickname) {
    lines.push(`# nickname: ${meta.nickname}`)
  }
  if (meta.createdAt) {
    lines.push(`# created-at: ${new Date(meta.createdAt).toISOString()}`)
  }
  if (meta.expiresAt) {
    lines.push(`# expires-at: ${new Date(meta.expiresAt).toISOString()}`)
  }

  for (const cookie of cookies) {
    lines.push([
      cookie.domain,
      cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE',
      cookie.path || '/',
      cookie.secure ? 'TRUE' : 'FALSE',
      String(cookie.expires),
      cookie.name,
      cookie.value
    ].join('\t'))
  }

  return lines.join('\n')
}

function parseCookieFileMeta(raw: string): CookieFileMeta {
  const meta: CookieFileMeta = {}
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('# nickname: ')) {
      meta.nickname = line.replace('# nickname: ', '').trim() || undefined
    }
    if (line.startsWith('# expires-at: ')) {
      const value = line.replace('# expires-at: ', '').trim()
      const parsed = Date.parse(value)
      if (Number.isFinite(parsed)) meta.expiresAt = parsed
    }
  }
  return meta
}

function readCookieExpiresAt(raw: string): number | undefined {
  const cookieLines = raw.split(/\r?\n/).filter(line => line && !line.startsWith('#'))
  const expires = cookieLines
    .map(line => line.split('\t'))
    .filter(parts => parts.length >= 7)
    .map(parts => Number.parseInt(parts[4], 10))
    .filter(value => Number.isFinite(value) && value > 0)

  if (expires.length === 0) return undefined
  return Math.min(...expires) * 1000
}

function safeReadFile(filepath: string): string {
  try {
    return fs.readFileSync(filepath, 'utf-8')
  } catch {
    return ''
  }
}

function formatRemainingTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '已失效'

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return `${minutes} 分钟`
  return '小于 1 分钟'
}
