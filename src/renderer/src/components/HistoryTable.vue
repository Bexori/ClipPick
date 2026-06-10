<template>
  <div class="history-table-wrap">
    <el-table
      :data="entries"
      v-loading="loading"
      style="width: 100%"
      empty-text="暂无下载记录"
      :default-sort="{ prop: 'downloadedAt', order: 'descending' }"
    >
      <el-table-column label="封面" width="100">
        <template #default="{ row }">
          <el-image
            :src="row.thumbnail"
            style="width: 80px; height: 45px; border-radius: 4px"
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

      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />

      <el-table-column prop="formatLabel" label="格式" width="90" />

      <el-table-column label="大小" width="90">
        <template #default="{ row }">
          {{ formatBytes(row.filesize) }}
        </template>
      </el-table-column>

      <el-table-column label="时间" width="160" sortable="custom">
        <template #default="{ row }">
          {{ formatDate(row.downloadedAt) }}
        </template>
      </el-table-column>

      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <span class="status-dot" :class="row.status" />
          {{ statusLabel(row.status) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="action-cell">
            <el-button
              v-if="row.status === 'completed'"
              size="small"
              @click="$emit('openFolder', row.filepath)"
            >
              打开
            </el-button>
            <el-button
              v-if="row.status === 'completed'"
              size="small"
              @click="$emit('process', row.filepath)"
            >
              处理
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="$emit('delete', row.id)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { VideoCamera } from '@element-plus/icons-vue'
import type { HistoryEntry } from '../../../shared/types'

defineProps<{
  entries: HistoryEntry[]
  loading: boolean
}>()

defineEmits<{
  delete: [id: string]
  process: [filepath: string]
  openFolder: [filepath: string]
}>()

function statusLabel(s: string): string {
  if (s === 'completed') return '完成'
  if (s === 'error') return '失败'
  return '取消'
}

function formatBytes(bytes: number): string {
  if (!bytes) return '--'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
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
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  overflow: hidden;
}

.thumb-fb {
  width: 80px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
  border-radius: 4px;
}

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

.action-cell {
  display: flex;
  gap: 6px;
}
</style>
