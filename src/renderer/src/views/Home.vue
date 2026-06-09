<template>
  <div class="download-page">
    <!-- 1. URL 输入 -->
    <UrlInputPanel
      v-model:url="url"
      :parsing="parsing"
      :has-video="!!videoInfo"
      @parse="handleParse"
      @paste="handlePaste"
      @clear="handleClear"
    />

    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      closable
      style="margin-bottom: 8px"
      @close="error = ''"
    />

    <!-- 2. 解析结果 -->
    <ParseResultPanel
      :status="pageStatus"
      :video-info="videoInfo"
    />

    <!-- 3. 下载配置 -->
    <DownloadConfig
      :status="pageStatus"
      :formats="videoInfo?.formats ?? []"
      v-model="selectedFormat"
      :save-path="savePath"
      :downloading="pageStatus === 'downloading'"
      @select-path="handleSelectPath"
      @download="handleDownload"
    />

    <!-- 4. 当前任务 -->
    <CurrentTask
      :task="activeTask"
      @cancel="handleCancelTask"
      @remove="handleRemoveTask"
      @open-folder="handleOpenFolder"
      @cancel-all="handleCancelAll"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useDownloadStore } from '../stores/download.store'
import { useSettingsStore } from '../stores/settings.store'
import { useHistoryStore } from '../stores/history.store'
import type {
  CompletePayload,
  ErrorPayload,
  ProgressPayload,
} from '../../../shared/types'
import UrlInputPanel from '../components/UrlInputPanel.vue'
import ParseResultPanel from '../components/ParseResultPanel.vue'
import DownloadConfig from '../components/DownloadConfig.vue'
import CurrentTask from '../components/CurrentTask.vue'

const downloadStore = useDownloadStore()
const settingsStore = useSettingsStore()
const historyStore = useHistoryStore()

// ---- 页面状态机 ----
type PageStatus = 'empty' | 'parsing' | 'success' | 'downloading'
const pageStatus = ref<PageStatus>('empty')
const parsing = ref(false)
const error = ref('')

// ---- 表单数据 ----
const url = ref('')
const selectedFormat = ref('')
const savePath = ref('')

// ---- 派生数据 ----
const videoInfo = computed(() => downloadStore.videoInfo)

const activeTask = computed(() => {
  const tasks = downloadStore.activeTasks
  return tasks.length > 0 ? tasks[0] : null
})

// ---- IPC 监听 ----
let unsubProgress: (() => void) | null = null
let unsubComplete: (() => void) | null = null
let unsubError: (() => void) | null = null

onMounted(() => {
  settingsStore.loadFromLocal()
  if (settingsStore.defaultSavePath) {
    savePath.value = settingsStore.defaultSavePath
  }

  unsubProgress = window.api.onDownloadProgress(handleProgress)
  unsubComplete = window.api.onDownloadComplete(handleComplete)
  unsubError = window.api.onDownloadError(handleError)
})

onUnmounted(() => {
  unsubProgress?.()
  unsubComplete?.()
  unsubError?.()
})

// ---- URL 操作 ----
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      url.value = text.trim()
    }
  } catch {
    // clipboard API may not be available
  }
}

function handleClear() {
  url.value = ''
  error.value = ''
  downloadStore.setVideoInfo(null)
  selectedFormat.value = ''
  pageStatus.value = 'empty'
}

// ---- 解析 ----
async function handleParse() {
  if (!url.value.trim()) return

  parsing.value = true
  error.value = ''
  pageStatus.value = 'parsing'

  try {
    const result = await window.api.parseVideo(url.value.trim())
    downloadStore.setVideoInfo(result)

    if (result.formats.length > 0) {
      const bestFormat =
        result.formats.find(f => f.hasVideo && f.hasAudio && f.height >= 720)
        || result.formats.find(f => f.hasVideo && f.hasAudio)
        || result.formats[0]
      selectedFormat.value = bestFormat.formatId
    }

    pageStatus.value = 'success'
  } catch (caughtError: unknown) {
    error.value = caughtError instanceof Error ? caughtError.message : '解析失败'
    downloadStore.setVideoInfo(null)
    pageStatus.value = 'empty'
  } finally {
    parsing.value = false
  }
}

// ---- 保存路径 ----
async function handleSelectPath() {
  const result = await window.api.selectSavePath()
  if (!result) return
  savePath.value = result
  settingsStore.defaultSavePath = result
}

// ---- 下载 ----
async function handleDownload() {
  if (!videoInfo.value || !selectedFormat.value || !savePath.value) return

  const format = videoInfo.value.formats.find(f => f.formatId === selectedFormat.value)
  const formatLabel = format
    ? `${format.height > 0 ? `${format.height}p` : 'audio'} ${format.ext.toUpperCase()}`
    : selectedFormat.value

  const taskId = await window.api.startDownload({
    url: url.value.trim(),
    formatId: selectedFormat.value,
    outputDir: savePath.value,
    filename: videoInfo.value.title,
  })

  downloadStore.addTask({
    taskId,
    videoId: videoInfo.value.id,
    title: videoInfo.value.title,
    thumbnail: videoInfo.value.thumbnail,
    url: url.value.trim(),
    formatLabel,
    outputDir: savePath.value,
    filename: videoInfo.value.title,
    status: 'queued',
    progress: 0,
    speed: '',
    eta: '',
    downloadedBytes: 0,
    totalBytes: 0,
    createdAt: new Date().toISOString(),
  })

  pageStatus.value = 'downloading'
  ElMessage.success('已添加到下载队列')
}

// ---- 下载进度回调 ----
function handleProgress(data: ProgressPayload) {
  downloadStore.updateTask(data.taskId, {
    status: data.status === 'post-processing' ? 'post-processing' : 'downloading',
    progress: data.percentage,
    speed: data.speed,
    eta: data.eta,
    downloadedBytes: data.downloadedBytes,
    totalBytes: data.totalBytes,
  })
}

function handleComplete(data: CompletePayload) {
  downloadStore.updateTask(data.taskId, {
    status: 'completed',
    progress: 100,
    completedAt: new Date().toISOString(),
  })

  const task = downloadStore.tasks.find(t => t.taskId === data.taskId)
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
      downloadedAt: new Date().toISOString(),
    })
  }

  pageStatus.value = 'success'
  ElMessage.success(`${task?.title ?? '视频'} 下载完成`)
}

function handleError(data: ErrorPayload) {
  downloadStore.updateTask(data.taskId, {
    status: 'error',
    error: data.error,
  })
  pageStatus.value = 'success'
  ElMessage.error(data.error)
}

// ---- 任务操作 ----
async function handleCancelTask(taskId: string) {
  await window.api.cancelDownload(taskId)
  downloadStore.updateTask(taskId, { status: 'cancelled' })
}

function handleRemoveTask(taskId: string) {
  downloadStore.removeTask(taskId)
  if (downloadStore.activeTasks.length === 0) {
    pageStatus.value = 'success'
  }
}

function handleOpenFolder(taskId: string) {
  const task = downloadStore.tasks.find(t => t.taskId === taskId)
  if (task) {
    window.api.openFileInFolder(task.outputDir)
  }
}

function handleCancelAll() {
  // Cancel all active tasks
  for (const t of downloadStore.activeTasks) {
    window.api.cancelDownload(t.taskId)
    downloadStore.updateTask(t.taskId, { status: 'cancelled' })
  }
  pageStatus.value = 'success'
}
</script>

<style scoped>
.download-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
