<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="680px"
    :close-on-click-modal="false"
    destroy-on-close
    class="playlist-dialog"
  >
    <div v-if="loading" class="playlist-loading">
      <div class="skeleton-row" v-for="n in 5" :key="n">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-info">
          <div class="skeleton-line w-70"></div>
          <div class="skeleton-line w-40"></div>
        </div>
      </div>
    </div>

    <template v-else-if="playlist">
      <div class="playlist-header">
        <span class="playlist-count">共 {{ playlist.entryCount }} 个视频</span>
        <div class="playlist-actions">
          <el-button size="small" text @click="selectAll">全选</el-button>
          <el-button size="small" text @click="deselectAll">取消全选</el-button>
        </div>
      </div>

      <div class="playlist-entries">
        <div
          v-for="entry in playlist.entries"
          :key="entry.id"
          class="playlist-entry"
          :class="{ selected: selectedIds.has(entry.id) }"
        >
          <el-checkbox
            :model-value="selectedIds.has(entry.id)"
            size="large"
            @change="toggleEntry(entry.id)"
          />
          <img
            v-if="entry.thumbnail"
            :src="entry.thumbnail"
            class="entry-thumb"
            loading="lazy"
            @error="(e) => { (e.target as HTMLImageElement).style.display = 'none' }"
          />
          <div class="entry-thumb-placeholder" v-else>
            <el-icon :size="22"><VideoCamera /></el-icon>
          </div>
          <div class="entry-info">
            <span class="entry-index">{{ entry.index }}.</span>
            <span class="entry-title">{{ entry.title }}</span>
          </div>
          <span class="entry-duration">{{ formatDuration(entry.duration) }}</span>
        </div>
      </div>
    </template>

    <div v-else class="playlist-error">
      <el-icon :size="20"><WarningFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="selectedIds.size === 0"
        :loading="downloading"
        @click="downloadSelected"
      >
        下载选中 ({{ selectedIds.size }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoCamera, WarningFilled } from '@element-plus/icons-vue'
import type { PlaylistParseResult, PlaylistEntry } from '../../../shared/types'
import { useDownloadStore } from '../stores/download.store'
import { useSettingsStore } from '../stores/settings.store'

const emit = defineEmits<{
  downloadEntries: [entries: PlaylistEntry[]]
}>()

const downloadStore = useDownloadStore()
const settingsStore = useSettingsStore()

const visible = ref(false)
const loading = ref(false)
const downloading = ref(false)
const playlist = ref<PlaylistParseResult | null>(null)
const error = ref('')
const selectedIds = ref(new Set<string>())

const dialogTitle = computed(() => {
  if (playlist.value) return playlist.value.title
  return '播放列表'
})

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function selectAll() {
  if (!playlist.value) return
  for (const e of playlist.value.entries) {
    selectedIds.value.add(e.id)
  }
}

function deselectAll() {
  selectedIds.value = new Set()
}

function toggleEntry(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

async function open(url: string) {
  visible.value = true
  loading.value = true
  error.value = ''
  playlist.value = null
  selectedIds.value = new Set()

  try {
    playlist.value = await window.api.parsePlaylist(url)
    // Select all by default (up to 20)
    const autoSelect = playlist.value.entries.slice(0, 20)
    for (const e of autoSelect) {
      selectedIds.value.add(e.id)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析播放列表失败'
  } finally {
    loading.value = false
  }
}

async function downloadSelected() {
  if (!playlist.value || selectedIds.value.size === 0) return
  downloading.value = true

  const selected = playlist.value.entries.filter(e => selectedIds.value.has(e.id))
  let added = 0

  for (const entry of selected) {
    try {
      // Parse each video to get formats
      const result = await window.api.parseVideo(entry.url)

      if (result.formats.length === 0) continue

      const format = result.formats[0]
      const formatLabel = `${format.height > 0 ? `${format.height}p` : 'audio'} ${format.ext.toUpperCase()}`

      const taskId = await window.api.startDownload({
        url: result.webpageUrl || entry.url,
        formatId: format.formatId,
        outputDir: settingsStore.defaultSavePath,
        filename: result.title,
        formatLabel
      })

      downloadStore.addTask({
        taskId,
        videoId: result.id,
        title: result.title,
        thumbnail: result.thumbnail,
        url: result.webpageUrl || entry.url,
        formatId: format.formatId,
        formatLabel,
        outputDir: settingsStore.defaultSavePath,
        filename: result.title,
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
      added++
    } catch {
      // Skip entries that fail to parse
    }
  }

  if (added > 0) {
    ElMessage.success(`已添加 ${added} 个视频到下载队列`)
  } else {
    ElMessage.warning('未能添加任何视频')
  }

  downloading.value = false
  visible.value = false
}

defineExpose({ open })
</script>

<style scoped>
.playlist-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-thumb {
  width: 80px;
  height: 45px;
  border-radius: var(--vb-radius-xs);
  background: var(--vb-bg-hover);
  flex-shrink: 0;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--vb-bg-hover);
  animation: shimmer 1.5s ease-in-out infinite;
}

.w-70 { width: 70%; }
.w-40 { width: 40%; }

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vb-border-light);
}

.playlist-count {
  font-size: 13px;
  color: var(--vb-text-secondary);
  font-weight: 500;
}

.playlist-actions {
  display: flex;
  gap: 4px;
}

.playlist-entries {
  max-height: 460px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.playlist-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 4px;
  border-radius: var(--vb-radius-sm);
  cursor: pointer;
  transition: background var(--vb-transition);
}

.playlist-entry:hover {
  background: var(--vb-bg-hover);
}

.playlist-entry.selected {
  background: var(--vb-accent-bg);
}

.entry-thumb,
.entry-thumb-placeholder {
  width: 72px;
  height: 40px;
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

.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.entry-index {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  flex-shrink: 0;
  min-width: 24px;
  text-align: right;
}

.entry-title {
  font-size: 13px;
  color: var(--vb-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-duration {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.playlist-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px;
  color: var(--vb-danger);
  font-size: 14px;
  justify-content: center;
}
</style>
