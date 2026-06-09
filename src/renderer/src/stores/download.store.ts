import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DownloadTask, VideoParseResult } from '../../../shared/types'

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

  return {
    tasks,
    videoInfo,
    activeTasks,
    addTask,
    updateTask,
    removeTask,
    setVideoInfo
  }
})
