import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export function getBinaryPath(binaryName: string): string {
  const isDev = !app.isPackaged
  const resourcesPath = isDev
    ? path.join(__dirname, '../../../resources')
    : path.join(process.resourcesPath)

  const binaryPath = path.join(resourcesPath, binaryName)

  if (fs.existsSync(binaryPath)) {
    return binaryPath
  }

  const devFallback = path.join(process.cwd(), 'resources', binaryName)
  if (fs.existsSync(devFallback)) return devFallback

  throw new Error(`Binary not found: ${binaryName}`)
}

export function getFfmpegPath(): string {
  try {
    return getBinaryPath('ffmpeg.exe')
  } catch {
    return ''
  }
}
