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

  rename(id: string, requestedName: string): HistoryEntry {
    const entry = this.entries.find(item => item.id === id)
    if (!entry) throw new Error('找不到对应的历史记录')
    if (!entry.filepath) throw new Error('历史记录没有关联文件')

    const currentPath = path.resolve(entry.filepath)
    if (!fs.existsSync(currentPath)) throw new Error('文件不存在，可能已被移动或删除')

    const name = requestedName.trim()
    if (!name) throw new Error('文件名不能为空')
    if (name === '.' || name === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(name)) {
      throw new Error('文件名包含不允许的字符')
    }
    if (/[. ]$/.test(name)) throw new Error('文件名不能以空格或句点结尾')
    if (name.length > 180) throw new Error('文件名过长')

    const current = path.parse(currentPath)
    const baseName = path.extname(name) ? name : `${name}${current.ext}`
    const targetPath = path.join(current.dir, baseName)
    const displayName = path.parse(baseName).name
    if (targetPath === currentPath) {
      const updated = { ...entry, title: displayName }
      this.entries = this.entries.map(item => item.id === id ? updated : item)
      this.saveToDisk()
      return { ...updated }
    }
    if (fs.existsSync(targetPath)) throw new Error('目标文件名已存在')

    const subtitleMoves = (entry.subtitleFiles ?? [])
      .filter(file => file && fs.existsSync(file))
      .filter(file => path.dirname(path.resolve(file)) === current.dir)
      .filter(file => path.basename(file).startsWith(current.base))
      .map(file => ({
        from: file,
        to: path.join(current.dir, baseName + path.basename(file).slice(current.base.length))
      }))

    if (subtitleMoves.some(move => fs.existsSync(move.to))) {
      throw new Error('目标字幕文件名已存在')
    }

    const moved: Array<{ from: string; to: string }> = []
    try {
      fs.renameSync(currentPath, targetPath)
      moved.push({ from: currentPath, to: targetPath })
      for (const move of subtitleMoves) {
        fs.renameSync(move.from, move.to)
        moved.push(move)
      }
    } catch (err) {
      for (const move of moved.reverse()) {
        try { fs.renameSync(move.to, move.from) } catch { /* best effort rollback */ }
      }
      throw new Error(`重命名失败：${err instanceof Error ? err.message : String(err)}`)
    }

    const updated: HistoryEntry = {
      ...entry,
      title: displayName,
      filepath: targetPath,
      subtitleFiles: (entry.subtitleFiles ?? []).map(file => {
        const match = subtitleMoves.find(move => move.from === file)
        return match?.to ?? file
      })
    }
    this.entries = this.entries.map(item => item.id === id ? updated : item)
    this.saveToDisk()
    return { ...updated }
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
        for (const subtitleFile of entry.subtitleFiles ?? []) {
          if (subtitleFile && fs.existsSync(subtitleFile)) {
            fs.unlinkSync(subtitleFile)
          }
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
      for (const subtitleFile of entry.subtitleFiles ?? []) {
        try { if (subtitleFile) fs.unlinkSync(subtitleFile) } catch { /* ignore */ }
      }
    }
    this.entries = []
    this.saveToDisk()
  }
}
