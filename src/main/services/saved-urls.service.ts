import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { SavedUrlEntry } from '../../shared/types'
import { logger } from '../utils/logger'

const DATA_FILE = 'saved-urls.json'

export class SavedUrlsService {
  private filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), DATA_FILE)
  }

  private read(): SavedUrlEntry[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        return Array.isArray(data) ? data : []
      }
    } catch (err) {
      logger.capture('saved-urls read failed', err)
    }
    return []
  }

  private write(entries: SavedUrlEntry[]): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf-8')
    } catch (err) {
      logger.capture('saved-urls write failed', err)
    }
  }

  getAll(): SavedUrlEntry[] {
    return this.read()
  }

  add(entry: { url: string; title: string; thumbnail: string; uploader: string }): SavedUrlEntry {
    const entries = this.read()
    const normalizedUrl = entry.url.trim()
    const saved: SavedUrlEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: normalizedUrl,
      title: entry.title,
      thumbnail: entry.thumbnail,
      uploader: entry.uploader,
      savedAt: new Date().toISOString()
    }

    const existingIndex = entries.findIndex(item => item.url === normalizedUrl)
    if (existingIndex >= 0) {
      const existing = entries[existingIndex]
      entries.splice(existingIndex, 1)
      entries.unshift({
        ...existing,
        ...saved,
        id: existing.id
      })
    } else {
      entries.unshift(saved)
    }

    this.write(entries)
    return entries[0]
  }

  delete(id: string): boolean {
    const entries = this.read()
    const next = entries.filter(entry => entry.id !== id)
    const changed = next.length !== entries.length
    if (changed) this.write(next)
    return changed
  }

  deleteByUrl(url: string): boolean {
    const normalizedUrl = url.trim()
    const entries = this.read()
    const next = entries.filter(entry => entry.url !== normalizedUrl)
    const changed = next.length !== entries.length
    if (changed) this.write(next)
    return changed
  }

  hasUrl(url: string): boolean {
    return this.read().some(entry => entry.url === url.trim())
  }
}
