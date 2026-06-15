import * as path from 'path'
import * as fs from 'fs'

function candidatePaths(resourceName: string): string[] {
  const devRoot = path.join(__dirname, '../../../resources')
  const packagedRoot = process.resourcesPath
  return [
    path.join(devRoot, resourceName),
    path.join(process.cwd(), 'resources', resourceName),
    path.join(packagedRoot, resourceName),
    path.join(packagedRoot, 'resources', resourceName)
  ]
}

export function getResourcePath(resourceName: string): string {
  for (const candidate of candidatePaths(resourceName)) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error(`Resource not found: ${resourceName}`)
}

export function getBinaryPath(binaryName: string): string {
  return getResourcePath(binaryName)
}

export function getFfmpegPath(): string {
  try {
    return getBinaryPath('ffmpeg.exe')
  } catch {
    return ''
  }
}
