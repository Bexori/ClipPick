import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { getFfmpegPath } from '../utils/paths'
import { spawnSafe } from '../utils/spawn-safe'

/**
 * Create a safe ASCII path on the same volume for FFmpeg.
 * Uses hard links when possible, copy as fallback (different volumes).
 */
function safePathForFfmpeg(originalPath: string, tag: string): { safePath: string; cleanup: () => void } {
  // Already ASCII-safe, no transformation needed
  if (!/[^\x00-\x7F]/.test(originalPath)) {
    return { safePath: originalPath, cleanup: () => {} }
  }

  const dir = path.dirname(originalPath)
  const ext = path.extname(originalPath)
  const safeName = `_vb_${tag}_${Date.now()}${ext}`
  const safePath = path.join(dir, safeName)

  // Try hard link first (instant, no copy)
  try {
    fs.linkSync(originalPath, safePath)
    return { safePath, cleanup: () => { try { fs.unlinkSync(safePath) } catch { /* ignore */ } } }
  } catch {
    // Hard link failed, try copy
    try {
      fs.copyFileSync(originalPath, safePath)
      return { safePath, cleanup: () => { try { fs.unlinkSync(safePath) } catch { /* ignore */ } } }
    } catch {
      // Both failed, fall back to original path
      return { safePath: originalPath, cleanup: () => {} }
    }
  }
}

export class FfmpegService {
  private binaryPath: string
  private tasks = new Map<string, any>()

  constructor() {
    this.binaryPath = getFfmpegPath()
  }

  convertVideo(
    req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string },
    onProgress: (data: { taskId: string; percentage: number }) => void,
    onComplete: (data: { taskId: string; outputPath: string }) => void,
    onError: (data: { taskId: string; error: string }) => void
  ): string {
    const taskId = randomUUID()
    const ext = req.outputFormat
    const baseName = req.outputFilename ||
      path.basename(req.inputPath, path.extname(req.inputPath))
    const outputDir = req.outputDir || path.dirname(req.inputPath)
    const outputPath = path.join(outputDir, `${baseName}.${ext}`)

    // Create safe ASCII paths for FFmpeg on Windows
    const inputSafe = safePathForFfmpeg(req.inputPath, 'in')
    const outputSafe = safePathForFfmpeg(outputPath, 'out')

    this.getDuration(inputSafe.safePath).then(duration => {
      const args = ['-i', inputSafe.safePath, '-progress', 'pipe:1', '-y', outputSafe.safePath]
      const proc = spawnSafe(this.binaryPath, args)

      this.tasks.set(taskId, { proc, outputPath, cleanup: () => { inputSafe.cleanup(); outputSafe.cleanup() } })

      let stderrAll = ''
      proc.stderr!.on('data', (data: Buffer) => {
        stderrAll += data.toString()
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
          if (timeMatch && duration > 0) {
            const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60
              + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 100
            const pct = Math.min(100, Math.round((secs / duration) * 100))
            onProgress({ taskId, percentage: pct })
          }
        }
      })

      proc.on('close', (code) => {
        const cleanup = this.tasks.get(taskId)?.cleanup
        this.tasks.delete(taskId)

        if (code === 0) {
          // If output was written to safe path, move to real path
          if (outputSafe.safePath !== outputPath) {
            try {
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
              fs.renameSync(outputSafe.safePath, outputPath)
            } catch { /* rename failed, keep safe path as result */ }
          }
          cleanup?.()
          onComplete({ taskId, outputPath: fs.existsSync(outputPath) ? outputPath : outputSafe.safePath })
        } else {
          cleanup?.()
          onError({ taskId, error: `FFmpeg 退出码 ${code}: ${stderrAll.slice(-200)}` })
        }
      })
    })

    return taskId
  }

  private getDuration(inputPath: string): Promise<number> {
    return new Promise((resolve) => {
      const proc = spawnSafe(this.binaryPath, ['-i', inputPath, '-f', 'null', '-'])
      let stderr = ''
      const timer = setTimeout(() => {
        proc.kill()
        resolve(0)
      }, 10000)

      proc.stderr!.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', () => {
        clearTimeout(timer)
        const match = stderr.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/)
        if (match) {
          resolve(parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]))
        } else {
          resolve(0)
        }
      })
    })
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawnSafe(this.binaryPath, ['-version'])
      let stdout = ''
      proc.stdout!.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout.split(/\r?\n/, 1)[0].trim() || 'unknown')
        else reject(new Error(`ffmpeg exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  }
}
