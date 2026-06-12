<template>
  <div class="home-page">
    <div class="parse-section">
      <div class="url-input-row">
        <el-input
          v-model="url"
          placeholder="粘贴视频链接，按 Enter 解析"
          size="large"
          clearable
          spellcheck="false"
          class="url-input"
          @keyup.enter="handleParse"
        >
          <template #prefix>
            <el-icon class="input-icon"><Link /></el-icon>
          </template>
        </el-input>
        <el-tooltip content="从剪贴板粘贴" :show-after="500">
          <el-button
            size="large"
            class="paste-btn"
            @click="handlePaste"
          >
            <el-icon :size="18"><CopyDocument /></el-icon>
          </el-button>
        </el-tooltip>
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
        <el-tooltip v-if="videoInfo" content="保存此链接" :show-after="500">
          <el-button
            size="large"
            class="save-btn"
            :class="{ saved: isUrlSaved }"
            :disabled="isUrlSaved"
            @click="handleSaveUrl"
          >
            <el-icon :size="18"><StarFilled v-if="isUrlSaved" /><Star v-else /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div class="platform-row">
        <span class="platform-label">支持</span>
        <span v-for="p in platforms" :key="p" class="platform-badge">{{ p }}</span>
      </div>
    </div>

    <div v-if="error" class="error-bar">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
      <button type="button" class="error-close" @click="error = ''">
        <el-icon :size="14"><Close /></el-icon>
      </button>
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

    <!-- ===== Playlist view ===== -->
    <template v-if="playlistResult && !selectedEntry">
      <div class="playlist-header">
        <div class="playlist-header-left">
          <el-icon :size="18"><List /></el-icon>
          <span class="playlist-header-title">{{ playlistResult.title }}</span>
          <el-tag size="small" round>{{ playlistResult.entryCount }} 个视频</el-tag>
        </div>
        <div class="playlist-header-right">
          <el-tooltip content="复制列表链接" :show-after="500">
            <el-button size="small" text circle @click.stop="copyPlaylistUrl">
              <el-icon :size="16"><CopyDocument /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip :content="isPlaylistSaved ? '已保存' : '保存列表'" :show-after="500">
            <el-button
              size="small"
              text
              circle
              :disabled="isPlaylistSaved"
              @click="savePlaylist"
            >
              <el-icon :size="16"><StarFilled v-if="isPlaylistSaved" /><Star v-else /></el-icon>
            </el-button>
          </el-tooltip>
          <el-button text size="small" @click="clearPlaylist">关闭列表</el-button>
        </div>
      </div>

      <div class="playlist-entries">
        <div
          v-for="entry in playlistResult.entries"
          :key="entry.id"
          class="playlist-entry"
          @click="selectEntry(entry)"
        >
          <img
            v-if="entry.thumbnail"
            :src="entry.thumbnail"
            class="entry-thumb"
            loading="lazy"
            @error="(e) => { (e.target as HTMLImageElement).style.display = 'none' }"
          />
          <div class="entry-thumb-placeholder" v-else>
            <el-icon :size="20"><VideoCamera /></el-icon>
          </div>
          <div class="entry-body">
            <span class="entry-title">{{ entry.title }}</span>
            <span class="entry-meta">
              <span class="entry-index">#{{ entry.index }}</span>
              <span v-if="entry.duration" class="entry-duration">{{ formatDuration(entry.duration) }}</span>
              <span v-if="entry.uploader" class="entry-uploader">{{ entry.uploader }}</span>
            </span>
          </div>
          <el-tooltip content="复制链接" :show-after="500">
            <el-button
              size="small"
              text
              circle
              class="entry-copy-btn"
              @click.stop="copyEntryUrl(entry)"
            >
              <el-icon :size="15"><CopyDocument /></el-icon>
            </el-button>
          </el-tooltip>
          <el-icon class="entry-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </template>

    <!-- ===== Selected entry detail ===== -->
    <template v-if="selectedEntry">
      <div class="entry-detail-back" @click="backToPlaylist">
        <el-icon :size="16"><ArrowLeft /></el-icon>
        <span>返回列表</span>
      </div>

      <div class="entry-detail-header">
        <img
          v-if="selectedEntry.thumbnail"
          :src="selectedEntry.thumbnail"
          class="entry-detail-thumb"
        />
        <div>
          <span class="entry-detail-index">#{{ selectedEntry.index }}</span>
          <span class="entry-detail-title">{{ selectedEntry.title }}</span>
        </div>
      </div>

      <div v-if="entryParsing" class="skeleton-card">
        <div class="skeleton-row">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-info">
            <div class="skeleton-line w-70"></div>
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line w-50"></div>
          </div>
        </div>
      </div>

      <div v-else-if="entryError" class="error-bar">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ entryError }}</span>
        <button type="button" class="error-close" @click="entryError = ''">
          <el-icon :size="14"><Close /></el-icon>
        </button>
      </div>

      <template v-if="entryVideoInfo && !entryParsing">
        <VideoInfo :info="entryVideoInfo" />

        <div class="action-card">
          <label class="field-label">选择格式</label>
          <FormatSelector v-model="entrySelectedFormat" :formats="entryVideoInfo.formats" />

          <el-button
            type="primary"
            size="large"
            class="download-btn"
            :disabled="!entrySelectedFormat"
            @click="downloadSelectedEntry"
          >
            <el-icon><Download /></el-icon>
            {{ entrySelectedFormat ? '开始下载' : '请选择格式' }}
          </el-button>
        </div>
      </template>
    </template>

    <!-- ===== Single video (non-playlist) ===== -->
    <template v-if="videoInfo && !parsing && !playlistResult && !selectedEntry">
      <VideoInfo :info="videoInfo" />

      <div v-if="showPlaylistBar" class="playlist-bar">
        <div class="playlist-bar-icon">
          <el-icon :size="18"><List /></el-icon>
        </div>
        <span class="playlist-bar-text">检测到{{ playlistLabel }}，可加载全部视频供选择下载</span>
        <el-button size="small" type="primary" :loading="loadingPlaylist" @click="loadPlaylist">
          加载{{ playlistLabel }}
        </el-button>
      </div>

      <div class="action-card">
        <label class="field-label">选择格式</label>
        <FormatSelector v-model="selectedFormat" :formats="videoInfo.formats" />

        <div v-if="videoInfo.subtitles.length > 0" class="subs-section">
          <el-checkbox v-model="enableSubs" class="subs-toggle">
            下载字幕
          </el-checkbox>
          <div v-if="enableSubs" class="subs-options">
            <div class="subs-row">
              <el-checkbox v-model="writeSubs">手动字幕</el-checkbox>
              <el-checkbox v-model="writeAutoSubs">自动字幕</el-checkbox>
              <el-checkbox v-model="embedSubs">嵌入视频</el-checkbox>
            </div>
            <div class="subs-lang-row">
              <span class="subs-lang-label">语言</span>
              <el-select
                v-model="selectedSubLangs"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="全部语言"
                size="small"
                class="subs-lang-select"
              >
                <el-option
                  v-for="sub in videoInfo.subtitles"
                  :key="sub.lang"
                  :label="sub.label"
                  :value="sub.lang"
                />
              </el-select>
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

    <DownloadList v-if="visibleTasks.length > 0" :tasks="visibleTasks" @retry="downloadStore.retryDownload" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Close, CopyDocument, Download, Link, List, Star, StarFilled, VideoCamera, WarningFilled } from '@element-plus/icons-vue'
import VideoInfo from '../components/VideoInfo.vue'
import FormatSelector from '../components/FormatSelector.vue'
import DownloadList from '../components/DownloadList.vue'
import { useDownloadStore } from '../stores/download.store'
import { useSettingsStore } from '../stores/settings.store'
import { useSavedUrlsStore } from '../stores/saved-urls.store'
import { isBilibiliUrl, isPlaylistUrl, getPlaylistLabel } from '../../../shared/url'
import type { PlaylistParseResult, PlaylistEntry, VideoParseResult } from '../../../shared/types'

const downloadStore = useDownloadStore()
const settingsStore = useSettingsStore()
const savedUrlsStore = useSavedUrlsStore()
const route = useRoute()

const platforms = ['YouTube', 'Bilibili', 'TikTok', '抖音', 'Twitter/X', 'Instagram']

const url = ref('')
const parsing = ref(false)
const error = ref('')
const selectedFormat = ref('')
const enableSubs = ref(false)
const writeSubs = ref(true)
const writeAutoSubs = ref(true)
const selectedSubLangs = ref<string[]>([])
const embedSubs = ref(false)

// Playlist state
const playlistResult = ref<PlaylistParseResult | null>(null)
const selectedEntry = ref<PlaylistEntry | null>(null)
const entryParsing = ref(false)
const entryError = ref('')
const entryVideoInfo = ref<VideoParseResult | null>(null)
const entrySelectedFormat = ref('')

const videoInfo = computed(() => downloadStore.videoInfo)
const visibleTasks = computed(() => downloadStore.tasks)

const showPlaylistBar = computed(() => {
  const currentUrl = url.value.trim()
  if (!currentUrl || !videoInfo.value) return false
  return isPlaylistUrl(currentUrl)
})

const playlistLabel = computed(() => {
  return getPlaylistLabel(url.value.trim()) || '播放列表'
})

const canDownload = computed(() => Boolean(videoInfo.value && selectedFormat.value))
const downloadButtonText = computed(() => {
  if (!videoInfo.value) return '下载'
  if (!selectedFormat.value) return '请选择格式'
  return '开始下载'
})

const loadingPlaylist = ref(false)

const isUrlSaved = computed(() => {
  const currentUrl = url.value.trim()
  if (!currentUrl) return false
  return savedUrlsStore.entries.some(e => e.url === currentUrl)
})

const isPlaylistSaved = computed(() => {
  const currentUrl = url.value.trim()
  if (!currentUrl) return false
  return savedUrlsStore.entries.some(e => e.url === currentUrl)
})

onMounted(async () => {
  await settingsStore.loadFromLocal()
  savedUrlsStore.loadSavedUrls()

  const queryUrl = route.query.url as string | undefined
  if (queryUrl) {
    url.value = queryUrl
    handleParse()
  }

  try {
    const recovered = await window.api.recoverUnfinished()
    if (recovered.length > 0) {
      for (const task of recovered) {
        downloadStore.addTask(task)
      }
      ElMessage.info(`检测到 ${recovered.length} 个未完成的下载任务，可点击"重试"重新下载。`)
    }
  } catch { /* recovery is best-effort */ }
})

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText()
    if (text.trim()) {
      url.value = text.trim()
    }
  } catch {
    ElMessage.warning('无法读取剪贴板，请手动粘贴')
  }
}

async function handleParse() {
  if (!url.value.trim()) return

  if (isBilibiliUrl(url.value.trim())) {
    try {
      const state = await window.api.getBiliState()
      if (state.expired) {
        ElMessage.warning('B站 Cookie 已过期，可能无法获取高清画质。请前往设置 → B站 重新登录。')
      }
    } catch { /* best-effort check */ }
  }

  // Bilibili space/collection URLs go straight to playlist
  if (isBilibiliSpaceUrl(url.value.trim())) {
    parsing.value = false
    await loadPlaylist()
    return
  }

  parsing.value = true
  error.value = ''
  clearPlaylist()

  try {
    const result = await window.api.parseVideo(url.value.trim())
    downloadStore.setVideoInfo(result)

    if (result.formats.length > 0) {
      selectedFormat.value = result.formats[0].formatId
    }
  } catch (caughtError: unknown) {
    if (isPlaylistUrl(url.value.trim())) {
      parsing.value = false
      await loadPlaylist()
      return
    }
    error.value = caughtError instanceof Error ? caughtError.message : '解析失败'
    downloadStore.setVideoInfo(null)
  } finally {
    parsing.value = false
  }
}

function isBilibiliSpaceUrl(input: string): boolean {
  try {
    const hostname = new URL(input).hostname.toLowerCase()
    return hostname === 'space.bilibili.com'
  } catch {
    return false
  }
}

async function loadPlaylist() {
  const currentUrl = url.value.trim()
  if (!currentUrl) return

  loadingPlaylist.value = true
  error.value = ''

  try {
    playlistResult.value = await window.api.parsePlaylist(currentUrl)
  } catch (caughtError: unknown) {
    error.value = caughtError instanceof Error ? caughtError.message : '解析播放列表失败'
  } finally {
    loadingPlaylist.value = false
  }
}

function clearPlaylist() {
  playlistResult.value = null
  selectedEntry.value = null
  entryVideoInfo.value = null
  entrySelectedFormat.value = ''
  entryError.value = ''
}

async function copyPlaylistUrl() {
  const currentUrl = url.value.trim()
  if (!currentUrl) return
  try {
    await navigator.clipboard.writeText(currentUrl)
    ElMessage.success('列表链接已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

async function copyEntryUrl(entry: PlaylistEntry) {
  try {
    await navigator.clipboard.writeText(entry.url)
    ElMessage.success(`已复制 #${entry.index} 链接`)
  } catch {
    ElMessage.warning('复制失败')
  }
}

async function savePlaylist() {
  const currentUrl = url.value.trim()
  if (!currentUrl) return
  await savedUrlsStore.addEntry({
    url: currentUrl,
    title: playlistResult.value?.title || playlistLabel.value,
    thumbnail: playlistResult.value?.entries[0]?.thumbnail || '',
    uploader: playlistResult.value?.uploader || ''
  })
  ElMessage.success('列表已保存')
}

async function selectEntry(entry: PlaylistEntry) {
  selectedEntry.value = entry
  entryParsing.value = true
  entryError.value = ''
  entryVideoInfo.value = null
  entrySelectedFormat.value = ''

  try {
    entryVideoInfo.value = await window.api.parseVideo(entry.url)
    if (entryVideoInfo.value.formats.length > 0) {
      entrySelectedFormat.value = entryVideoInfo.value.formats[0].formatId
    }
  } catch (caughtError: unknown) {
    entryError.value = caughtError instanceof Error ? caughtError.message : '解析失败'
  } finally {
    entryParsing.value = false
  }
}

function backToPlaylist() {
  selectedEntry.value = null
  entryVideoInfo.value = null
  entrySelectedFormat.value = ''
  entryError.value = ''
}

async function downloadSelectedEntry() {
  if (!entryVideoInfo.value || !entrySelectedFormat.value || !selectedEntry.value) return

  const sourceUrl = (entryVideoInfo.value.webpageUrl || selectedEntry.value.url).trim()
  const format = entryVideoInfo.value.formats.find(item => item.formatId === entrySelectedFormat.value)
  const formatLabel = format
    ? `${format.height > 0 ? `${format.height}p` : 'audio'} ${format.ext.toUpperCase()}`
    : entrySelectedFormat.value

  const taskId = await window.api.startDownload({
    url: sourceUrl,
    formatId: entrySelectedFormat.value,
    outputDir: settingsStore.defaultSavePath,
    filename: entryVideoInfo.value.title,
    formatLabel
  })

  downloadStore.addTask({
    taskId,
    videoId: entryVideoInfo.value.id,
    title: entryVideoInfo.value.title,
    thumbnail: entryVideoInfo.value.thumbnail,
    url: sourceUrl,
    formatId: entrySelectedFormat.value,
    formatLabel,
    outputDir: settingsStore.defaultSavePath,
    filename: entryVideoInfo.value.title,
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

async function handleDownload() {
  if (!videoInfo.value || !selectedFormat.value) return
  const sourceUrl = (videoInfo.value.webpageUrl || url.value).trim()
  if (!sourceUrl) {
    ElMessage.error('下载失败：视频链接为空，请重新解析链接')
    return
  }

  const format = videoInfo.value.formats.find(item => item.formatId === selectedFormat.value)
  const formatLabel = format
    ? `${format.height > 0 ? `${format.height}p` : 'audio'} ${format.ext.toUpperCase()}`
    : selectedFormat.value

  const subLangsValue = enableSubs.value && selectedSubLangs.value.length > 0
    ? selectedSubLangs.value.join(',')
    : undefined

  const taskId = await window.api.startDownload({
    url: sourceUrl,
    formatId: selectedFormat.value,
    outputDir: settingsStore.defaultSavePath,
    filename: videoInfo.value.title,
    formatLabel,
    writeSubs: enableSubs.value && writeSubs.value,
    writeAutoSubs: enableSubs.value && writeAutoSubs.value,
    subLangs: subLangsValue,
    embedSubs: enableSubs.value && embedSubs.value
  })

  downloadStore.addTask({
    taskId,
    videoId: videoInfo.value.id,
    title: videoInfo.value.title,
    thumbnail: videoInfo.value.thumbnail,
    url: sourceUrl,
    formatId: selectedFormat.value,
    formatLabel,
    outputDir: settingsStore.defaultSavePath,
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

async function handleSaveUrl() {
  if (!videoInfo.value) return
  await savedUrlsStore.addEntry({
    url: videoInfo.value.webpageUrl || url.value.trim(),
    title: videoInfo.value.title,
    thumbnail: videoInfo.value.thumbnail,
    uploader: videoInfo.value.uploader
  })
  ElMessage.success('链接已保存')
}

</script>

<style scoped>
.home-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 28px 48px;
}

.parse-section {
  margin-bottom: 20px;
}

.platform-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.platform-label {
  font-size: 11px;
  color: var(--vb-text-tertiary);
  margin-right: 2px;
}

.platform-badge {
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--vb-bg-hover);
  color: var(--vb-text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.url-input-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
}

.url-input :deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: var(--vb-shadow-sm);
}

.paste-btn {
  border-radius: 10px;
}

.parse-btn {
  min-width: 96px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: var(--vb-shadow-sm);
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

.error-close {
  margin-left: auto;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 50%;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
  padding: 0;
  transition: background var(--vb-transition), border-color var(--vb-transition);
}

.error-close:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
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

/* ===== Playlist list ===== */
.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
}

.playlist-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--vb-accent);
}

.playlist-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.playlist-header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vb-text);
}

.playlist-entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 24px;
}

.playlist-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  cursor: pointer;
  transition: background var(--vb-transition), border-color var(--vb-transition);
}

.playlist-entry:hover {
  background: var(--vb-bg-hover);
  border-color: var(--vb-accent-light);
}

.entry-thumb,
.entry-thumb-placeholder {
  width: 80px;
  height: 45px;
  border-radius: var(--vb-radius-xs);
  object-fit: cover;
  flex-shrink: 0;
}

.entry-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
}

.entry-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-index {
  display: none;
}

.entry-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vb-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--vb-text-tertiary);
}

.entry-copy-btn {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--vb-transition);
}

.playlist-entry:hover .entry-copy-btn {
  opacity: 1;
}

.entry-arrow {
  color: var(--vb-text-tertiary);
  flex-shrink: 0;
}

/* ===== Entry detail ===== */
.entry-detail-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  margin-bottom: 12px;
  border-radius: var(--vb-radius-xs);
  color: var(--vb-accent);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--vb-transition);
}

.entry-detail-back:hover {
  background: var(--vb-accent-bg);
}

.entry-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.entry-detail-thumb {
  width: 120px;
  height: 68px;
  border-radius: var(--vb-radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}

.entry-detail-index {
  display: block;
  font-size: 11px;
  color: var(--vb-text-tertiary);
  margin-bottom: 2px;
}

.entry-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vb-text);
}

.action-card {
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 20px;
  margin-bottom: 24px;
}

.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--vb-text-secondary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 8px;
}

/* ===== Subtitle options ===== */
.subs-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vb-border);
}

.subs-toggle {
  margin-bottom: 0;
}

.subs-options {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.subs-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.subs-lang-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subs-lang-label {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  flex-shrink: 0;
}

.subs-lang-select {
  min-width: 160px;
  max-width: 320px;
  flex: 1;
}

.download-btn {
  margin-top: 20px;
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
}

/* ===== Playlist bar ===== */
.playlist-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--vb-accent-bg);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: var(--vb-radius-sm);
}

.playlist-bar-icon {
  flex-shrink: 0;
  color: var(--vb-accent);
}

.playlist-bar-text {
  flex: 1;
  font-size: 13px;
  color: var(--vb-text-secondary);
  line-height: 1.4;
}

/* ===== Save button ===== */
.save-btn {
  border-radius: 10px;
  min-width: 44px;
  transition: all var(--vb-transition);
}

.save-btn.saved {
  color: var(--vb-accent);
  border-color: var(--vb-accent);
  background: var(--vb-accent-bg);
  opacity: 0.7;
}

@media (max-width: 700px) {
  .home-page {
    padding: 24px 16px;
  }

  .url-input-row {
    flex-direction: column;
  }
}
</style>
