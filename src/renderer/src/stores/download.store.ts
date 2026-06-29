import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import type { DownloadTask, VideoParseResult, CompletePayload, ErrorPayload, ProgressPayload } from '../../../shared/types'
import { useHistoryStore } from './history.store'
import { useSettingsStore } from './settings.store'

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<DownloadTask[]>([])
  const videoInfo = ref<VideoParseResult | null>(null)

  const activeTasks = computed(() =>
    tasks.value.filter(t =>
      ['queued', 'downloading', 'post-processing'].includes(t.status)
    )
  )

  function addTask(task: DownloadTask) {
    const existingIndex = tasks.value.findIndex(item => item.taskId === task.taskId)
    if (existingIndex !== -1) {
      tasks.value.splice(existingIndex, 1)
    }
    tasks.value.unshift(task)
  }

  function updateTask(taskId: string, updates: Partial<DownloadTask>) {
    const idx = tasks.value.findIndex(t => t.taskId === taskId)
    if (idx !== -1) {
      Object.assign(tasks.value[idx], updates)
    }
  }

  function removeTask(taskId: string) {
    tasks.value = tasks.value.filter(t => t.taskId !== taskId)
  }

  function setVideoInfo(info: VideoParseResult | null) {
    videoInfo.value = info
  }

  async function retryDownload(taskId: string, automatic = false) {
    const task = tasks.value.find(item => item.taskId === taskId)
    if (!task) return
    if (!task.url.trim()) {
      updateTask(taskId, {
        status: 'error',
        error: 'Retry failed: task URL is empty. Parse the link again before downloading'
      })
      return
    }

    const nextTaskId = await window.api.startDownload({
      url: task.url,
      formatId: task.formatId,
      outputDir: task.outputDir,
      filename: task.filename,
      formatLabel: task.formatLabel
    })

    removeTask(taskId)
    addTask({
      ...task,
      taskId: nextTaskId,
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      downloadedBytes: 0,
      totalBytes: 0,
      error: undefined,
      errorDetail: undefined,
      retryCount: (task.retryCount ?? 0) + 1,
      createdAt: new Date().toISOString(),
      completedAt: undefined
    })

    if (!automatic) ElMessage.success('Task requeued')
  }

  function subtitleCompletionMessage(data: CompletePayload): { type: 'success' | 'warning'; message: string } | null {
    const files = data.subtitleFiles ?? []

    if (data.subtitleStatus === 'embedded') {
      return {
        type: 'success',
        message: '已封装字幕轨。播放时请在播放器的字幕菜单里选择内嵌字幕轨。'
      }
    }

    if (data.subtitleStatus === 'external') {
      return {
        type: 'success',
        message: files.length > 0
          ? `已下载外挂字幕。字幕文件与视频保存在同一目录；大多数播放器会自动加载，如未显示，请在字幕菜单手动选择。`
          : '已下载外挂字幕。请在播放器的字幕菜单中手动选择字幕文件。'
      }
    }

    if (data.subtitleStatus === 'embed-failed') {
      return {
        type: 'warning',
        message: '封装失败，仅保留外挂字幕。请在播放器的字幕菜单中手动加载同目录字幕文件。'
      }
    }

    return null
  }

  window.api.onDownloadProgress((data: ProgressPayload) => {
    updateTask(data.taskId, {
      status: data.status === 'post-processing' ? 'post-processing' : 'downloading',
      progress: data.percentage,
      speed: data.speed,
      eta: data.eta,
      downloadedBytes: data.downloadedBytes,
      totalBytes: data.totalBytes
    })
  })

  window.api.onDownloadComplete((data: CompletePayload) => {
    const settingsStore = useSettingsStore()
    const historyStore = useHistoryStore()

    updateTask(data.taskId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString()
    })

    const task = tasks.value.find(item => item.taskId === data.taskId)
    if (task) {
      historyStore.addEntry({
        id: data.taskId,
        videoId: task.videoId,
        title: task.title,
        thumbnail: task.thumbnail,
        formatLabel: task.formatLabel,
        filepath: data.filepath,
        filesize: data.filesize,
        duration: 0,
        status: 'completed',
        downloadedAt: new Date().toISOString(),
        subtitleFiles: data.subtitleFiles ?? [],
        subtitleStatus: data.subtitleStatus ?? 'none'
      })
    }

    if (settingsStore.downloadNotifications) {
      ElMessage.success(`${task?.title ?? 'Video'} download complete`)
    }

    const subtitleNotice = subtitleCompletionMessage(data)
    if (subtitleNotice) {
      ElNotification({
        title: subtitleNotice.type === 'success' ? '字幕处理完成' : '字幕处理提醒',
        message: subtitleNotice.message,
        type: subtitleNotice.type,
        duration: 5500
      })
    }

    window.setTimeout(() => {
      removeTask(data.taskId)
    }, 3000)
  })

  window.api.onDownloadError((data: ErrorPayload) => {
    const settingsStore = useSettingsStore()
    const task = tasks.value.find(item => item.taskId === data.taskId)

    updateTask(data.taskId, {
      status: 'error',
      error: data.error,
      errorDetail: data.detail
    })

    if (task && (task.retryCount ?? 0) < (task.maxRetries ?? settingsStore.autoRetryCount)) {
      window.setTimeout(() => retryDownload(data.taskId, true), 1200)
      return
    }

    ElMessage.error(data.error)
  })

  return {
    tasks,
    videoInfo,
    activeTasks,
    addTask,
    updateTask,
    removeTask,
    setVideoInfo,
    retryDownload
  }
})
