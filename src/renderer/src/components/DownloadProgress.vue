<template>
  <div class="download-progress">
    <div class="progress-header">
      <span class="title" :title="task.title">{{ task.title }}</span>
      <el-tag :type="statusType" size="small" class="status-tag">{{ statusText }}</el-tag>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :class="{ 'is-error': task.status === 'error', 'is-done': task.status === 'completed', 'is-indeterminate': task.status === 'post-processing' }"
          :style="{ width: task.status === 'post-processing' ? '100%' : task.progress + '%' }"
        />
      </div>
    </div>
    <div class="progress-stats">
      <span v-if="task.speed">{{ task.speed }}</span>
      <span v-if="task.eta">剩余 {{ task.eta }}</span>
      <span v-if="task.totalBytes > 0">
        {{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}
      </span>
      <span class="format-badge">{{ task.formatLabel }}</span>
      <span v-if="task.error" class="error-text">{{ task.error }}</span>
    </div>
    <div class="progress-actions">
      <el-button
        v-if="task.status === 'downloading'"
        type="danger"
        size="small"
        text
        @click="$emit('cancel', task.taskId)"
      >
        取消
      </el-button>
      <el-button
        v-else-if="task.status === 'completed'"
        type="primary"
        size="small"
        text
        @click="$emit('openFolder', task.taskId)"
      >
        <el-icon><FolderOpened /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpened } from '@element-plus/icons-vue'
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
.download-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 200px;
  flex-shrink: 0;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
  font-weight: 500;
}

.status-tag {
  flex-shrink: 0;
}

.progress-bar-wrap {
  flex: 1;
  min-width: 80px;
}

.progress-bar {
  height: 4px;
  background: #ebeef5;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #409eff;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-fill.is-indeterminate {
  animation: indeterminate 1.5s ease-in-out infinite;
  width: 100% !important;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-fill.is-done {
  background: #67c23a;
}

.progress-fill.is-error {
  background: #f56c6c;
}

.progress-stats {
  display: flex;
  gap: 10px;
  color: #909399;
  white-space: nowrap;
  font-size: 11px;
  flex-shrink: 0;
}

.format-badge {
  color: #c0c4cc;
}

.error-text {
  color: #f56c6c;
}

.progress-actions {
  flex-shrink: 0;
}
</style>
