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
  proxy: '',
  downloadNotifications: true,
  autoRetryCount: 1
}

export class SettingsService {
  private filePath: string
  private settings: AppSettings = { ...defaultSettings }

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.loadFromDisk()
  }

  get(): AppSettings {
    return {
      ...this.settings,
      defaultSavePath: this.resolveDefaultPath()
    }
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      concurrentDownloads: clampNumber(patch.concurrentDownloads ?? this.settings.concurrentDownloads, 1, 8),
      autoRetryCount: clampNumber(patch.autoRetryCount ?? this.settings.autoRetryCount, 0, 3)
    }
    this.saveToDisk()
    return this.get()
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
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  private updateShape(raw: Partial<AppSettings>): AppSettings {
    return {
      ...defaultSettings,
      ...raw,
      concurrentDownloads: clampNumber(raw.concurrentDownloads ?? defaultSettings.concurrentDownloads, 1, 8),
      autoRetryCount: clampNumber(raw.autoRetryCount ?? defaultSettings.autoRetryCount, 0, 3)
    }
  }
}

function clampNumber(value: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}
