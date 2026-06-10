<template>
  <div class="home-page">
    <div class="parse-section" :class="{ 'has-video': videoInfo }">
      <div v-if="!videoInfo" class="parse-hero">
        <div class="hero-icon">
          <el-icon :size="40"><Download /></el-icon>
        </div>
        <h2 class="hero-title">下载在线视频</h2>
        <p class="hero-desc">支持 YouTube、Bilibili、Twitter/X、TikTok、抖音等 1000+ 站点</p>
      </div>

      <div class="url-input-row">
        <el-input
          v-model="url"
          placeholder="粘贴视频链接，按 Enter 解析"
          size="large"
          clearable
          class="url-input"
          @keyup.enter="handleParse"
        >
          <template #prefix>
            <el-icon class="input-icon"><Link /></el-icon>
          </template>
        </el-input>
        <el-button
          type="primary"
          size="large"
          :loading="parsing"
          :disabled="!url.trim()"
          class="parse-btn"
          @click="handleParse"
        >
          {{ parsing ? '解析中...' : '解析' }}
        </el-button>
      </div>
    </div>

    <div v-if="error" class="error-bar">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
      <el-button type="primary" link size="small" @click="error = ''">关闭</el-button>
    </div>

    <div v-if="parsing" class="skeleton-card">
      <div class="skeleton-row">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-info">
          <div class="skeleton-line w-70"></div>
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-50"></div>
        </div>
      </div>
    </div>

    <template v-if="videoInfo && !parsing">
      <VideoInfo :info="videoInfo" />

      <div class="action-card">
        <div class="action-grid">
          <div>
            <label class="field-label">选择格式</label>
            <FormatSelector v-model="selectedFormat" :formats="videoInfo.formats" />
          </div>
          <div>
            <label class="field-label">保存到</label>
            <div class="save-card" :class="{ empty: !savePath }">
              <div class="save-icon">
                <el-icon><FolderOpened /></el-icon>
              </div>
              <div class="save-info">
                <strong>{{ savePath ? folderName(savePath) : '选择保存目录' }}</strong>
                <span>{{ savePath || '下载前需要选择一个本地文件夹' }}</span>
              </div>
              <el-button size="small" @click="handleSelectPath">
                {{ savePath ? '更改' : '选择' }}
              </el-button>
            </div>
          </div>
        </div>

        <el-button
          type="primary"
          size="large"
          class="download-btn"
          :disabled="!canDownload"
          @click="handleDownload"
        >
          <el-icon><Download /></el-icon>
          {{ downloadButtonText }}
        </el-button>
      </div>
    </template>

    <DownloadList v-if="visibleTasks.length > 0" :tasks="visibleTasks" @retry="retryDownload" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Download, FolderOpened, Link, WarningFilled } from '@element-plus/icons-vue'
import VideoInfo from '../components/VideoInfo.vue'
import FormatSelector from '../components/FormatSelector.vue'
import DownloadList from '../components/DownloadList.vue'
import { useDownloadStore } from '../stores/download.store'
import { useHistoryStore } from '../stores/history.store'
import { useSettingsStore } from '../stores/settings.store'
import type { CompletePayload, ErrorPayload, ProgressPayload } from '../../../shared/types'

const downloadStore = useDownloadStore()
const settingsStore = useSettingsStore()
const historyStore = useHistoryStore()

const url = ref('')
const parsing = ref(false)
const error = ref('')
const selectedFormat = ref('')
const savePath = ref('')

let unsubProgress: (() => void) | null = null
let unsubComplete: (() => void) | null = null
let unsubError: (() => void) | null = null

const videoInfo = computed(() => downloadStore.videoInfo)
const visibleTasks = computed(() => downloadStore.tasks)

const canDownload = computed(() => Boolean(videoInfo.value && selectedFormat.value && savePath.value))
const downloadButtonText = computed(() => {
  if (!videoInfo.value) return '下载'
  if (!selectedFormat.value) return '请选择格式'
  if (!savePath.value) return '请选择保存目录'
  return '开始下载'
})

onMounted(async () => {
  await settingsStore.loadFromLocal()
  if (settingsStore.defaultSavePath) savePath.value = settingsStore.defaultSavePath

  unsubProgress = window.api.onDownloadProgress(handleProgress)
  unsubComplete = window.api.onDownloadComplete(handleComplete)
  unsubError = window.api.onDownloadError(handleError)
})

onUnmounted(() => {
  unsubProgress?.()
  unsubComplete?.()
  unsubError?.()
})

async function handleParse() {
  if (!url.value.trim()) return

  parsing.value = true
  error.value = ''

  try {
    const result = await window.api.parseVideo(url.value.trim())
    downloadStore.setVideoInfo(result)

    if (result.formats.length > 0) {
      const bestFormat =
        result.formats.find(format => format.hasVideo && format.hasAudio && format.height >= 720) ||
        result.formats.find(format => format.hasVideo && format.hasAudio) ||
        result.formats[0]

      selectedFormat.value = bestFormat.formatId
    }
  } catch (caughtError: unknown) {
    error.value = caughtError instanceof Error ? caughtError.message : '解析失败'
    downloadStore.setVideoInfo(null)
  } finally {
    parsing.value = false
  }
}

async function handleSelectPath() {
  const result = await window.api.selectSavePath()
  if (!result) return

  savePath.value = result
  settingsStore.defaultSavePath = result
  await settingsStore.saveSettings({ defaultSavePath: result })
}

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

async function handleDownload() {
  if (!videoInfo.value || !selectedFormat.value || !savePath.value) return
  const sourceUrl = (videoInfo.value.webpageUrl || url.value).trim()
  if (!sourceUrl) {
    ElMessage.error('下载失败：视频链接为空，请重新解析链接')
    return
  }

  const format = videoInfo.value.formats.find(item => item.formatId === selectedFormat.value)
  const formatLabel = format
    ? `${format.height > 0 ? `${format.height}p` : 'audio'} ${format.ext.toUpperCase()}`
    : selectedFormat.value

  const taskId = await window.api.startDownload({
    url: sourceUrl,
    formatId: selectedFormat.value,
    outputDir: savePath.value,
    filename: videoInfo.value.title
  })

  downloadStore.addTask({
    taskId,
    videoId: videoInfo.value.id,
    title: videoInfo.value.title,
    thumbnail: videoInfo.value.thumbnail,
    url: sourceUrl,
    formatId: selectedFormat.value,
    formatLabel,
    outputDir: savePath.value,
    filename: videoInfo.value.title,
    status: 'queued',
    progress: 0,
    speed: '',
    eta: '',
    downloadedBytes: 0,
    totalBytes: 0,
    retryCount: 0,
    maxRetries: settingsStore.autoRetryCount,
    createdAt: new Date().toISOString()
  })

  ElMessage.success('已添加到下载队列')
}

function handleProgress(data: ProgressPayload) {
  downloadStore.updateTask(data.taskId, {
    status: data.status === 'post-processing' ? 'post-processing' : 'downloading',
    progress: data.percentage,
    speed: data.speed,
    eta: data.eta,
    downloadedBytes: data.downloadedBytes,
    totalBytes: data.totalBytes
  })
}

function handleComplete(data: CompletePayload) {
  downloadStore.updateTask(data.taskId, {
    status: 'completed',
    progress: 100,
    completedAt: new Date().toISOString()
  })

  const task = downloadStore.tasks.find(item => item.taskId === data.taskId)
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
    ElNotification.success({
      title: '下载完成',
      message: task?.title ?? '视频下载完成'
    })
  }

  ElMessage.success(`${task?.title ?? '视频'} 下载完成`)
  window.setTimeout(() => {
    downloadStore.removeTask(data.taskId)
  }, 3000)
}

function handleError(data: ErrorPayload) {
  const task = downloadStore.tasks.find(item => item.taskId === data.taskId)
  downloadStore.updateTask(data.taskId, {
    status: 'error',
    error: data.error,
    errorDetail: data.detail
  })

  if (task && (task.retryCount ?? 0) < (task.maxRetries ?? settingsStore.autoRetryCount)) {
    window.setTimeout(() => retryDownload(data.taskId, true), 1200)
    return
  }

  ElMessage.error(data.error)
}

async function retryDownload(taskId: string, automatic = false) {
  const task = downloadStore.tasks.find(item => item.taskId === taskId)
  if (!task) return
  if (!task.url.trim()) {
    downloadStore.updateTask(taskId, {
      status: 'error',
      error: '重试失败：任务链接为空，请重新解析后下载'
    })
    return
  }

  const nextTaskId = await window.api.startDownload({
    url: task.url,
    formatId: task.formatId,
    outputDir: task.outputDir,
    filename: task.filename
  })

  downloadStore.removeTask(taskId)
  downloadStore.addTask({
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
</script>

<style scoped>
.home-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 28px;
}

.parse-section {
  margin-bottom: 28px;
  transition: all var(--vb-transition);
}

.parse-hero {
  text-align: center;
  padding: 48px 0 32px;
}

.hero-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-accent-bg);
  border-radius: 18px;
  color: var(--vb-accent-light);
}

.hero-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--vb-text);
  margin-bottom: 8px;
}

.hero-desc {
  font-size: 14px;
  color: var(--vb-text-secondary);
  max-width: 460px;
  margin: 0 auto;
  line-height: 1.6;
}

.parse-section.has-video .parse-hero {
  display: none;
}

.url-input-row {
  display: flex;
  gap: 10px;
}

.url-input {
  flex: 1;
}

.input-icon {
  color: var(--vb-text-tertiary);
}

.parse-btn {
  min-width: 100px;
  font-weight: 600;
}

.error-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 20px;
  background: var(--vb-danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--vb-radius-sm);
  color: #dc2626;
  font-size: 13px;
}

.error-bar .el-button {
  margin-left: auto;
  flex-shrink: 0;
}

.skeleton-card {
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 20px;
  margin-bottom: 20px;
}

.skeleton-row {
  display: flex;
  gap: 20px;
}

.skeleton-thumb {
  width: 200px;
  height: 112px;
  border-radius: var(--vb-radius-sm);
  background: var(--vb-bg-hover);
  flex-shrink: 0;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: var(--vb-bg-hover);
  animation: shimmer 1.5s ease-in-out infinite;
}

.w-70 { width: 70%; }
.w-50 { width: 50%; }
.w-40 { width: 40%; }

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.action-card {
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 24px;
  margin-bottom: 24px;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--vb-text-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.save-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 78px;
  padding: 12px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  background: #fff;
}

.save-card.empty {
  border-style: dashed;
  background: var(--vb-bg-elevated);
}

.save-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--vb-radius-sm);
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
}

.save-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.save-info strong {
  color: var(--vb-text);
  font-size: 14px;
}

.save-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.download-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 700px) {
  .home-page {
    padding: 24px 18px;
  }

  .url-input-row {
    flex-direction: column;
  }

  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
