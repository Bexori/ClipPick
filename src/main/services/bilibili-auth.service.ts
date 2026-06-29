import * as fs from 'fs'
import * as path from 'path'
import { app, net, session } from 'electron'
import type { IncomingHttpHeaders } from 'http'
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
  createdAt?: number
  expiresAt?: number
}

interface NetTextResponse {
  statusCode: number
  body: string
  headers: IncomingHttpHeaders
}

const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const REQUEST_TIMEOUT = '__REQUEST_TIMEOUT__'

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
      const json = await this.requestJson<{ code: number; data?: { qrcode_key: string; url: string } }>(
        'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
        '获取二维码'
      )

      if (json.code !== 0 || !json.data) {
        throw new Error('获取二维码失败，请稍后重试')
      }

      return { qrcode_key: json.data.qrcode_key, qrUrl: json.data.url }
    } catch (err) {
      logger.capture('bilibili generateQrCode failed', err)
      throw this.normalizeBiliError(err, '暂时无法连接 B站 登录服务，请检查网络或代理后重试')
    }
  }

  async pollLogin(qrcode_key: string): Promise<{ status: string; message: string; nickname?: string; cookiesPath?: string }> {
    try {
      const url = `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`
      const res = await this.requestText(url, {
        headers: { 'User-Agent': BILI_UA },
        timeoutMs: 15_000
      })

      const json = JSON.parse(res.body) as {
        code: number
        data?: { code: number; message: string; nickname?: string }
      }

      if (json.code !== 0 || !json.data) {
        throw new Error('轮询登录状态失败')
      }

      const data = json.data
      if (data.code === 0) {
        const cookies = collectSetCookies(res.headers)
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

          logger.info('Bilibili login confirmed', {
            nickname: data.nickname,
            cookies: cookies.length,
            expiresAt
          })

          return {
            status: 'confirmed',
            message: '登录成功',
            nickname: data.nickname,
            cookiesPath: cookiesFile
          }
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
      if (data.code === 86090) return { status: 'scanned', message: '已扫码，请在手机上确认' }
      if (data.code === 86101) return { status: 'waiting', message: '等待扫码' }
      return { status: 'waiting', message: data.message || '等待扫码' }
    } catch (err) {
      logger.capture('bilibili pollLogin failed', err)
      throw this.normalizeBiliError(err, '登录轮询失败，请刷新二维码后重试')
    }
  }

  getState(): BiliLoginState {
    const cookiesFile = this.cookiesPath
    const exists = fs.existsSync(cookiesFile) && fs.statSync(cookiesFile).size > 0

    if (!exists) {
      return {
        loggedIn: false,
        expired: false,
        cookiesPath: cookiesFile
      }
    }

    const raw = safeReadFile(cookiesFile)
    const meta = parseCookieFileMeta(raw)
    const expiresAt = meta.expiresAt || readCookieExpiresAt(raw)
    const now = Date.now()
    const remainingSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : undefined
    const expired = expiresAt ? expiresAt <= now : false

    return {
      loggedIn: true,
      expired,
      nickname: meta.nickname,
      cookiesPath: cookiesFile,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      expiresInSeconds: remainingSeconds,
      expiresInText: typeof remainingSeconds === 'number' ? formatRemainingTime(remainingSeconds) : undefined
    }
  }

  clearCookies(): void {
    const filepath = this.cookiesPath
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }
  }

  isCookieExpired(): boolean {
    const state = this.getState()
    return state.loggedIn && state.expired
  }

  private async requestJson<T>(url: string, actionLabel: string): Promise<T> {
    const res = await this.requestText(url, {
      headers: { 'User-Agent': BILI_UA },
      timeoutMs: 15_000
    })

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`${actionLabel}失败（${res.statusCode}）`)
    }

    return JSON.parse(res.body) as T
  }

  private async requestText(
    url: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: string
      timeoutMs?: number
    } = {}
  ): Promise<NetTextResponse> {
    const proxy = this.settings.get().proxy.trim()
    const requestSession = session.fromPartition(`clip-pick-bili-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    if (proxy) {
      await requestSession.setProxy({
        proxyRules: proxy,
        proxyBypassRules: '<local>'
      })
    }

    return await new Promise<NetTextResponse>((resolve, reject) => {
      const request = net.request({
        url,
        method: options.method || 'GET',
        session: requestSession
      })

      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn()
      }

      const timer = setTimeout(() => {
        request.abort()
        finish(() => reject(new Error(REQUEST_TIMEOUT)))
      }, options.timeoutMs ?? 15_000)

      for (const [key, value] of Object.entries(options.headers || {})) {
        request.setHeader(key, value)
      }

      request.on('response', response => {
        const chunks: Buffer[] = []
        response.on('data', chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          finish(() => resolve({
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString('utf-8'),
            headers: response.headers
          }))
        })
      })

      request.on('error', error => {
        finish(() => reject(error))
      })

      if (options.body) {
        request.write(options.body)
      }

      request.end()
    })
  }

  private normalizeBiliError(err: unknown, fallback: string): Error {
    if (err instanceof Error) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message === REQUEST_TIMEOUT) {
        return new Error('连接 B站 登录服务超时，请检查网络或代理后重试')
      }

      const message = err.message || ''
      if (message.includes('fetch failed') || message.includes('ECONNRESET') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        const proxy = this.settings.get().proxy.trim()
        return new Error(proxy
          ? '无法连接 B站 登录服务，请检查代理配置是否可用'
          : '无法连接 B站 登录服务，请检查网络连接后重试')
      }

      return new Error(message)
    }

    return new Error(fallback)
  }
}

function collectSetCookies(headers: IncomingHttpHeaders): RawCookie[] {
  const rawHeader = headers['set-cookie']
  const rawHeaders = Array.isArray(rawHeader)
    ? rawHeader
    : splitSetCookieHeader(typeof rawHeader === 'string' ? rawHeader : '')

  return rawHeaders
    .map(parseCookie)
    .filter((cookie): cookie is RawCookie => Boolean(cookie))
}

function splitSetCookieHeader(input: string): string[] {
  if (!input) return []

  const parts: string[] = []
  let start = 0
  let inExpires = false

  for (let i = 0; i < input.length; i += 1) {
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
  const candidates = cookies
    .map(cookie => cookie.expires)
    .filter(expires => Number.isFinite(expires) && expires > 0)

  const localLimit = Date.now() + fallbackHours * 60 * 60 * 1000
  if (candidates.length > 0) {
    return Math.min(Math.min(...candidates) * 1000, localLimit)
  }

  return localLimit
}

function formatNetscapeCookies(cookies: RawCookie[], meta: CookieFileMeta = {}): string {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# Generated by ClipPick'
  ]

  if (meta.nickname) lines.push(`# nickname: ${meta.nickname}`)
  if (meta.createdAt) lines.push(`# created-at: ${new Date(meta.createdAt).toISOString()}`)
  if (meta.expiresAt) lines.push(`# expires-at: ${new Date(meta.expiresAt).toISOString()}`)

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
    if (line.startsWith('# created-at: ')) {
      const value = line.replace('# created-at: ', '').trim()
      const parsed = Date.parse(value)
      if (Number.isFinite(parsed)) meta.createdAt = parsed
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
  return '少于 1 分钟'
}
