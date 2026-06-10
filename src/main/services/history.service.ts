import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { HistoryEntry } from '../../shared/types'

export class HistoryService {
  private filePath: string
  private entries: HistoryEntry[] = []

  constructor() {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'download-history.json')
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.entries = JSON.parse(raw)
      }
    } catch {
      this.entries = []
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save history:', err)
    }
  }

  getAll(): HistoryEntry[] {
    return [...this.entries]
  }

  add(entry: HistoryEntry): void {
    // 去重: 相同 filepath 则更新
    const idx = this.entries.findIndex(e => e.filepath === entry.filepath)
    if (idx !== -1) {
      this.entries[idx] = entry
    } else {
      this.entries.unshift(entry)
    }
    if (this.entries.length > 500) {
      this.entries.length = 500
    }
    this.saveToDisk()
  }

  delete(id: string): { deleted: boolean; filepath?: string } {
    const entry = this.entries.find(e => e.id === id)
    this.entries = this.entries.filter(e => e.id !== id)
    this.saveToDisk()

    if (entry?.filepath) {
      try {
        if (fs.existsSync(entry.filepath)) {
          fs.unlinkSync(entry.filepath)
        }
        // also try removing the parent directory if empty
        const parent = path.dirname(entry.filepath)
        if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
          fs.rmdirSync(parent)
        }
      } catch {
        // file deletion is best-effort
      }
    }

    return { deleted: true, filepath: entry?.filepath }
  }

  clear(): void {
    for (const entry of this.entries) {
      if (entry.filepath) {
        try { fs.unlinkSync(entry.filepath) } catch { /* ignore */ }
      }
    }
    this.entries = []
    this.saveToDisk()
  }
}
