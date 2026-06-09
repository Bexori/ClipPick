<template>
  <div class="download-item">
    <div class="download-header">
      <span class="download-title">{{ task.title }}</span>
      <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
    </div>

    <el-progress
      :percentage="task.progress"
      :status="task.status === 'error' ? 'exception' : task.status === 'completed' ? 'success' : undefined"
      :indeterminate="task.status === 'post-processing'"
      style="margin: 8px 0"
    />

    <div class="download-stats">
      <span v-if="task.speed">{{ task.speed }}</span>
      <span v-if="task.eta">剩余 {{ task.eta }}</span>
      <span v-if="task.totalBytes > 0">
        {{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}
      </span>
      <span class="format-label">{{ task.formatLabel }}</span>
    </div>

    <div v-if="task.error" class="download-error">
      {{ task.error }}
    </div>

    <div class="download-actions" v-if="task.status !== 'completed' && task.status !== 'error'">
      <el-button
        v-if="task.status === 'downloading'"
        type="danger"
        size="small"
        plain
        @click="$emit('cancel', task.taskId)"
      >
        取消
      </el-button>
    </div>
    <div class="download-actions" v-else-if="task.status === 'completed'">
      <el-button
        type="success"
        size="small"
        plain
        @click="$emit('openFolder', task.taskId)"
      >
        打开文件位置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DownloadTask } from '../../../shared/types'

const props = defineProps<{
  task: DownloadTask
}>()

defineEmits<{
  cancel: [taskId: string]
  openFolder: [taskId: string]
}>()

const statusMap: Record<string, { text: string; type: '' | 'success' | 'warning' | 'info' | 'danger' }> = {
  queued: { text: '排队中', type: 'info' },
  downloading: { text: '下载中', type: '' },
  'post-processing': { text: '处理中', type: 'warning' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' },
  error: { text: '失败', type: 'danger' }
}

const statusText = computed(() => statusMap[props.task.status]?.text ?? props.task.status)
const statusType = computed(() => statusMap[props.task.status]?.type ?? 'info')

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}
</script>

<style scoped>
.download-item {
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}

.download-item:last-child {
  border-bottom: none;
}

.download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.download-title {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.download-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.format-label {
  color: #c0c4cc;
}

.download-error {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 4px;
}

.download-actions {
  margin-top: 8px;
}
</style>
