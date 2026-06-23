<template>
  <div class="history-table-wrap">
    <el-table
      :data="entries"
      v-loading="loading"
      stripe
      style="width: 100%"
      empty-text="暂无下载记录"
      :default-sort="{ prop: 'downloadedAt', order: 'descending' }"
      row-key="id"
      size="default"
      :show-header="showHeader"
    >
      <el-table-column label="封面" width="88" align="center" header-align="center">
        <template #default="{ row }">
          <el-image :src="row.thumbnail" class="thumb-img" fit="cover">
            <template #error>
              <div class="thumb-fb">
                <el-icon><VideoCamera /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" min-width="260" show-overflow-tooltip header-align="center" />

      <el-table-column label="格式" width="130" show-overflow-tooltip align="center" header-align="center">
        <template #default="{ row }">
          <span class="meta-text">{{ row.formatLabel }}</span>
        </template>
      </el-table-column>

      <el-table-column label="字幕" width="126" align="center" header-align="center">
        <template #default="{ row }">
          <el-tooltip v-if="row.subtitleFiles?.length" :content="row.subtitleFiles.join('\n')" placement="top">
            <el-tag :type="subtitleTagType(row.subtitleStatus)" size="small" effect="light">
              {{ subtitleText(row) }}
            </el-tag>
          </el-tooltip>
          <el-tag v-else :type="subtitleTagType(row.subtitleStatus)" size="small" effect="light">
            {{ subtitleText(row) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="大小" width="110" sortable="custom" align="center" header-align="center">
        <template #default="{ row }">
          <span class="meta-text">{{ formatBytes(row.filesize) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="时长" width="90" align="center" header-align="center">
        <template #default="{ row }">
          <span class="meta-text">{{ formatDuration(row.duration) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="110" align="center" header-align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small" effect="light">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="时间" width="160" sortable="custom" header-align="center">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.downloadedAt) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="72" align="center" class-name="action-col" header-align="center">
        <template #default="{ row }">
          <MoreActionDropdown
            :row="row"
            @open-location="$emit('openLocation', $event)"
            @process="$emit('process', $event)"
            @delete="$emit('delete', $event)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { VideoCamera } from '@element-plus/icons-vue'
import type { HistoryEntry } from '../../../shared/types'
import MoreActionDropdown from './MoreActionDropdown.vue'

withDefaults(defineProps<{
  entries: HistoryEntry[]
  loading: boolean
  showHeader?: boolean
}>(), {
  showHeader: true
})

defineEmits<{
  openLocation: [row: HistoryEntry]
  process: [row: HistoryEntry]
  delete: [row: HistoryEntry]
}>()

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function statusText(status: HistoryEntry['status']): string {
  const map: Record<HistoryEntry['status'], string> = {
    completed: '已完成',
    cancelled: '已取消',
    error: '失败'
  }
  return map[status]
}

function statusTagType(status: HistoryEntry['status']): 'success' | 'info' | 'danger' {
  const map: Record<HistoryEntry['status'], 'success' | 'info' | 'danger'> = {
    completed: 'success',
    cancelled: 'info',
    error: 'danger'
  }
  return map[status]
}

function subtitleText(row: HistoryEntry): string {
  const map: Record<NonNullable<HistoryEntry['subtitleStatus']>, string> = {
    none: '无字幕',
    external: row.subtitleFiles?.length ? `外挂 ${row.subtitleFiles.length}` : '外挂字幕',
    embedded: '已内嵌',
    'embed-failed': '嵌入失败'
  }
  return map[row.subtitleStatus ?? 'none']
}

function subtitleTagType(status: HistoryEntry['subtitleStatus']): 'info' | 'success' | 'warning' | 'danger' {
  const map: Record<NonNullable<HistoryEntry['subtitleStatus']>, 'info' | 'success' | 'warning' | 'danger'> = {
    none: 'info',
    external: 'warning',
    embedded: 'success',
    'embed-failed': 'danger'
  }
  return map[status ?? 'none']
}
</script>

<style scoped>
.history-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.thumb-img {
  width: 72px;
  height: 48px;
  border-radius: 6px;
}

.thumb-fb {
  width: 72px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
  border-radius: 6px;
}

.time-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
}

.meta-text {
  color: var(--vb-text-secondary);
  font-size: 13px;
}

:deep(.action-col) {
  padding: 0 !important;
}

:deep(.action-col .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px !important;
}

:deep(.el-table__body td .cell) {
  font-size: 13px;
}
</style>

<style>
.history-table-wrap .el-table__header th {
  background: var(--vb-bg-surface);
}
</style>
