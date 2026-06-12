<template>
  <div class="history-table-wrap">
    <el-table
      :data="entries"
      v-loading="loading"
      style="width: 100%"
      empty-text="暂无下载记录"
      :default-sort="{ prop: 'downloadedAt', order: 'descending' }"
      row-key="id"
      size="default"
    >
      <el-table-column label="封面" width="88" header-align="center">
        <template #default="{ row }">
          <el-image
            :src="row.thumbnail"
            class="thumb-img"
            fit="cover"
          >
            <template #error>
              <div class="thumb-fb">
                <el-icon><VideoCamera /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip header-align="center" />

      <el-table-column label="格式" width="100" header-align="center">
        <template #default="{ row }">
          <span class="format-tag">{{ row.formatLabel || '--' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="大小" width="90" align="right" header-align="center">
        <template #default="{ row }">
          <span class="size-text">{{ formatBytes(row.filesize) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="时间" width="160" sortable="custom" header-align="center">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.downloadedAt) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="70" header-align="center">
        <template #default="{ row }">
          <span class="status-dot" :class="row.status" />
          {{ statusLabel(row.status) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="54" fixed="right" class-name="action-col" header-align="center">
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

defineProps<{
  entries: HistoryEntry[]
  loading: boolean
}>()

defineEmits<{
  openLocation: [row: HistoryEntry]
  process: [row: HistoryEntry]
  delete: [row: HistoryEntry]
}>()

function statusLabel(s: string): string {
  if (s === 'completed') return '完成'
  if (s === 'error') return '失败'
  return '取消'
}

function formatBytes(bytes: number): string {
  if (!bytes) return '--'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${i === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[i]}`
}

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.history-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
}

/* ── 封面 ── */
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

/* ── 格式标签 ── */
.format-tag {
  display: inline-block;
  font-size: 12px;
  color: var(--vb-text-secondary);
  background: var(--vb-bg-hover);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

/* ── 大小 ── */
.size-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ── 时间 ── */
.time-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
}

/* ── 状态点 ── */
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.status-dot.completed { background: var(--vb-success); }
.status-dot.error     { background: var(--vb-danger); }
.status-dot.cancelled { background: var(--vb-text-tertiary); }

/* ── 操作列：去除 element 自带 padding，居中 ── */
:deep(.action-col) {
  padding: 0 !important;
}
:deep(.action-col .cell) {
  display: flex;
  justify-content: center;
  padding: 0 4px !important;
}

/* ── 标题列加粗 ── */
:deep(.el-table__body td .cell) {
  font-size: 13px;
}
</style>

<style>
/* ── 固定列阴影透明化 ── */
.history-table-wrap .el-table__fixed-right {
  box-shadow: none !important;
}
.history-table-wrap .el-table__fixed-right-patch {
  background: transparent !important;
}

/* ── dropdown z-index 高于固定列 ── */
.history-table-wrap .el-table__fixed-right {
  z-index: 2;
}
</style>
