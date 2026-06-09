import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import type { StartDownloadRequest, ProgressPayload, CompletePayload } from '../../shared/types'
import { getFfmpegPath } from '../utils/paths'

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
      require('path').basename(req.inputPath, require('path').extname(req.inputPath))
    const outputDir = req.outputDir || require('path').dirname(req.inputPath)
    const outputPath = require('path').join(outputDir, `${baseName}.${ext}`)

    this.getDuration(req.inputPath).then(duration => {
      const args = ['-i', req.inputPath, '-progress', 'pipe:1', '-y', outputPath]
      const proc = spawn(this.binaryPath, args)

      this.tasks.set(taskId, { proc, outputPath })

      let stderrAll = ''
      proc.stderr.on('data', (data: Buffer) => {
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
        this.tasks.delete(taskId)
        if (code === 0) {
          onComplete({ taskId, outputPath })
        } else {
          onError({ taskId, error: `FFmpeg 退出码 ${code}: ${stderrAll.slice(-200)}` })
        }
      })
    })

    return taskId
  }

  extractAudio(
    req: { inputPath: string; outputDir?: string; outputFormat: string; outputFilename?: string },
    onProgress: (data: { taskId: string; percentage: number }) => void,
    onComplete: (data: { taskId: string; outputPath: string }) => void,
    onError: (data: { taskId: string; error: string }) => void
  ): string {
    const taskId = randomUUID()
    const ext = req.outputFormat
    const baseName = req.outputFilename ||
      require('path').basename(req.inputPath, require('path').extname(req.inputPath))
    const outputDir = req.outputDir || require('path').dirname(req.inputPath)
    const outputPath = require('path').join(outputDir, `${baseName}.${ext}`)

    const codecMap: Record<string, string> = {
      mp3: 'libmp3lame', flac: 'flac', aac: 'aac', wav: 'pcm_s16le', opus: 'libopus', m4a: 'aac'
    }
    const codec = codecMap[ext] || 'copy'

    this.getDuration(req.inputPath).then(duration => {
      const args = ['-i', req.inputPath, '-vn', '-c:a', codec, '-progress', 'pipe:1', '-y', outputPath]
      const proc = spawn(this.binaryPath, args)

      this.tasks.set(taskId, { proc, outputPath })

      let stderrAll = ''
      proc.stderr.on('data', (data: Buffer) => {
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
        this.tasks.delete(taskId)
        if (code === 0) {
          onComplete({ taskId, outputPath })
        } else {
          onError({ taskId, error: `FFmpeg 退出码 ${code}: ${stderrAll.slice(-200)}` })
        }
      })
    })

    return taskId
  }

  private getDuration(inputPath: string): Promise<number> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ['-i', inputPath, '-f', 'null', '-'])
      let stderr = ''
      const timer = setTimeout(() => {
        proc.kill()
        resolve(0)
      }, 10000)

      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
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
}
