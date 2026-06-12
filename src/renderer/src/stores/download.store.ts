import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
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
        error: '重试失败：任务链接为空，请重新解析后下载'
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

    if (!automatic) ElMessage.success('已重新加入下载队列')
  }

  // IPC listeners — registered once on store creation, persist across page navigations
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
        url: task.url,
        formatLabel: task.formatLabel,
        filepath: data.filepath,
        filesize: data.filesize,
        duration: 0,
        status: 'completed',
        downloadedAt: new Date().toISOString()
      })
    }

    if (settingsStore.downloadNotifications) {
      ElMessage.success(`${task?.title ?? '视频'} 下载完成`)
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
