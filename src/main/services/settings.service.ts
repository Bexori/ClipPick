import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppSettings } from '../../shared/types'

function getDefaultSavePath(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'downloads')
  }
  return path.join(app.getAppPath(), 'downloads')
}

export const defaultSettings: AppSettings = {
  defaultSavePath: '',
  concurrentDownloads: 3,
  cookieMode: 'auto',
  cookieBrowser: 'edge',
  cookiesFile: '',
  biliCookieHours: 168,
  proxy: '',
  downloadNotifications: true,
  autoRetryCount: 1,
  translateProfiles: [],
  activeProfileId: ''
}

export class SettingsService {
  private filePath: string
  private apiKeysPath: string
  private settings: AppSettings = { ...defaultSettings }
  private apiKeys: Record<string, string> = {}

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.apiKeysPath = path.join(app.getPath('userData'), 'translate-keys.json')
    this.loadFromDisk()
    this.loadApiKeys()
  }

  get(): AppSettings {
    return {
      ...this.settings,
      defaultSavePath: this.resolveDefaultPath(),
      translateProfiles: this.withKeyState(this.settings.translateProfiles)
    }
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.stripDerivedFields(this.settings),
      ...patch,
      concurrentDownloads: clampNumber(patch.concurrentDownloads ?? this.settings.concurrentDownloads, 1, 8),
      autoRetryCount: clampNumber(patch.autoRetryCount ?? this.settings.autoRetryCount, 0, 3),
      biliCookieHours: clampNumber(patch.biliCookieHours ?? this.settings.biliCookieHours, 1, 8760)
    }
    this.settings.translateProfiles = this.withKeyState(this.settings.translateProfiles)
    this.saveToDisk()
    return this.get()
  }

  setApiKey(profileId: string, key: string): AppSettings {
    if (!profileId) return this.get()

    const trimmed = key.trim()
    if (trimmed) {
      this.apiKeys[profileId] = trimmed
    } else {
      delete this.apiKeys[profileId]
    }

    this.saveApiKeys()
    this.settings.translateProfiles = this.settings.translateProfiles.map(profile =>
      profile.id === profileId ? { ...profile, hasKey: Boolean(trimmed) } : profile
    )
    this.saveToDisk()
    return this.get()
  }

  getApiKey(profileId: string): string {
    return this.apiKeys[profileId] || ''
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) return

      const raw = fs.readFileSync(this.filePath, 'utf-8')
      this.settings = this.updateShape(JSON.parse(raw))
    } catch {
      this.settings = { ...defaultSettings }
    }
  }

  private loadApiKeys(): void {
    try {
      if (!fs.existsSync(this.apiKeysPath)) return
      const raw = fs.readFileSync(this.apiKeysPath, 'utf-8')
      const parsed = JSON.parse(raw)
      this.apiKeys = parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
    } catch {
      this.apiKeys = {}
    }
  }

  private resolveDefaultPath(): string {
    if (this.settings.defaultSavePath) return this.settings.defaultSavePath
    const p = getDefaultSavePath()
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const payload = {
        ...this.stripDerivedFields(this.settings),
        translateProfiles: this.stripKeyState(this.settings.translateProfiles)
      }
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  private saveApiKeys(): void {
    try {
      const dir = path.dirname(this.apiKeysPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.apiKeysPath, JSON.stringify(this.apiKeys, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save API keys:', err)
    }
  }

  private updateShape(raw: Partial<AppSettings>): AppSettings {
    const normalized = {
      ...defaultSettings,
      ...raw,
      concurrentDownloads: clampNumber(raw.concurrentDownloads ?? defaultSettings.concurrentDownloads, 1, 8),
      autoRetryCount: clampNumber(raw.autoRetryCount ?? defaultSettings.autoRetryCount, 0, 3),
      biliCookieHours: clampNumber(raw.biliCookieHours ?? defaultSettings.biliCookieHours, 1, 8760)
    }
    return {
      ...normalized,
      translateProfiles: this.withKeyState(normalized.translateProfiles),
      activeProfileId: normalized.activeProfileId || normalized.translateProfiles[0]?.id || ''
    }
  }

  private withKeyState(profiles: AppSettings['translateProfiles']): AppSettings['translateProfiles'] {
    return (profiles || []).map(profile => ({
      ...profile,
      hasKey: Boolean(this.apiKeys[profile.id])
    }))
  }

  private stripKeyState(profiles: AppSettings['translateProfiles']): AppSettings['translateProfiles'] {
    return (profiles || []).map(profile => ({
      ...profile,
      hasKey: Boolean(this.apiKeys[profile.id])
    }))
  }

  private stripDerivedFields(settings: AppSettings): AppSettings {
    return {
      ...settings,
      defaultSavePath: settings.defaultSavePath,
      translateProfiles: this.stripKeyState(settings.translateProfiles)
    }
  }
}

function clampNumber(value: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}
