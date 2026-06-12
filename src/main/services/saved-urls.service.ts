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
    const saved: SavedUrlEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: entry.url,
      title: entry.title,
      thumbnail: entry.thumbnail,
      uploader: entry.uploader,
      savedAt: new Date().toISOString()
    }
    entries.unshift(saved)
    this.write(entries)
    return saved
  }

  delete(id: string): void {
    const entries = this.read().filter(e => e.id !== id)
    this.write(entries)
  }
}
