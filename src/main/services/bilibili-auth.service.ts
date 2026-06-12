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
}

export class BilibiliAuthService {
  private settings: SettingsService

  constructor(settings: SettingsService) {
    this.settings = settings
  }

  private get cookiesPath(): string {
    return path.join(app.getPath('userData'), 'bilibili-cookies.json')
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
      // Login confirmed — save cookies from the response
      const cookies = (res.headers as any)['set-cookie'] || []
      const cookiesFile = this.cookiesPath
      fs.writeFileSync(cookiesFile, JSON.stringify({ cookies, nickname: data.nickname }))
      logger.info('Bilibili login confirmed', { nickname: data.nickname })
      return { status: 'confirmed', message: '登录成功', nickname: data.nickname, cookiesPath: cookiesFile }
    }
    if (data.code === 86038) return { status: 'expired', message: '二维码已过期' }
    if (data.code === 86090) return { status: 'scanned', message: '已扫码，请在手机上确认' }
    if (data.code === 86101) return { status: 'waiting', message: '等待扫码' }
    return { status: 'waiting', message: data.message || '等待扫码' }
  }

  getState(): BiliLoginState {
    const cookiesFile = this.cookiesPath
    const loggedIn = fs.existsSync(cookiesFile)
    let nickname: string | undefined
    if (loggedIn) {
      try {
        const data = JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'))
        nickname = data.nickname
      } catch { /* ignore */ }
    }
    return { loggedIn, expired: !loggedIn, nickname, cookiesPath: cookiesFile }
  }

  clearCookies(): void {
    const p = this.cookiesPath
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  isCookieExpired(): boolean {
    return !fs.existsSync(this.cookiesPath)
  }
}
