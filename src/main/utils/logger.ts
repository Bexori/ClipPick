import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logFile = (() => {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, 'app.log')
  } catch {
    return ''
  }
})()

function timestamp(): string {
  return new Date().toISOString()
}

function write(level: string, msg: string, extra?: unknown) {
  const line = `[${timestamp()}] ${level} ${msg}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}\n`
  if (logFile) {
    try { fs.appendFileSync(logFile, line) } catch { /* ignore */ }
  }
}

export const logger = {
  info(msg: string, extra?: unknown) {
    write('INFO', msg, extra)
  },
  warn(msg: string, extra?: unknown) {
    write('WARN', msg, extra)
  },
  error(msg: string, extra?: unknown) {
    write('ERROR', msg, extra)
  },
  capture(label: string, err: unknown, extra?: unknown) {
    const message = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err ?? 'unknown')
    write('CAPTURE', `${label}: ${message}`, extra)
  }
}

export function errorMessage(err: unknown, fallback = '未知错误'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}
