<template>
  <div class="task-item" :class="`status-${task.status}`">
    <div class="task-top">
      <span class="task-title">{{ task.title }}</span>
      <span class="task-badge" :class="badgeClass">{{ statusText }}</span>
    </div>

    <el-progress
      :percentage="task.progress"
      :indeterminate="task.status === 'post-processing'"
      :stroke-width="6"
      :show-text="false"
      :color="progressColor"
    />

    <div class="task-stats">
      <div class="stats-left">
        <span v-if="task.speed">{{ task.speed }}</span>
        <span v-if="task.eta">剩余 {{ task.eta }}</span>
        <span v-if="task.totalBytes > 0">
          {{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}
        </span>
        <span v-if="task.retryCount">已重试 {{ task.retryCount }} 次</span>
      </div>
      <span class="task-format">{{ task.formatLabel }}</span>
    </div>

    <div v-if="task.error" class="task-error">
      <span>{{ task.error }}</span>
      <el-button v-if="task.errorDetail" link size="small" @click="copyError">复制详情</el-button>
    </div>

    <div class="task-actions">
      <el-button
        v-if="task.status === 'downloading' || task.status === 'queued'"
        size="small"
        @click="$emit('cancel', task.taskId)"
      >
        取消
      </el-button>
      <el-button
        v-if="task.status === 'error'"
        type="primary"
        size="small"
        @click="$emit('retry', task.taskId)"
      >
        重试
      </el-button>
      <el-button
        v-if="task.status === 'completed'"
        type="primary"
        size="small"
        @click="$emit('openFolder', task.taskId)"
      >
        打开文件夹
      </el-button>
      <el-button
        v-if="task.status === 'completed' || task.status === 'error' || task.status === 'cancelled'"
        size="small"
        @click="$emit('remove', task.taskId)"
      >
        关闭
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { DownloadTask } from '../../../shared/types'

const props = defineProps<{
  task: DownloadTask
}>()

defineEmits<{
  cancel: [taskId: string]
  retry: [taskId: string]
  remove: [taskId: string]
  openFolder: [taskId: string]
}>()

const statusMap: Record<string, string> = {
  queued: '排队中',
  downloading: '下载中',
  'post-processing': '处理中',
  completed: '已完成',
  cancelled: '已取消',
  error: '失败'
}

const statusText = computed(() => statusMap[props.task.status] ?? props.task.status)

const badgeClass = computed(() => {
  const map: Record<string, string> = {
    queued: 'badge-info',
    downloading: 'badge-info',
    'post-processing': 'badge-warn',
    completed: 'badge-ok',
    cancelled: 'badge-muted',
    error: 'badge-err'
  }
  return map[props.task.status] ?? 'badge-muted'
})

const progressColor = computed(() => {
  if (props.task.status === 'error') return '#ef4444'
  if (props.task.status === 'completed') return '#10b981'
  return '#6366f1'
})

async function copyError() {
  await navigator.clipboard.writeText(props.task.errorDetail || props.task.error || '')
  ElMessage.success('错误详情已复制')
}

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
.task-item {
  padding: 16px;
  border-radius: var(--vb-radius-sm);
  background: var(--vb-bg);
  transition: background var(--vb-transition);
}

.task-item + .task-item {
  margin-top: 8px;
}

.task-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.task-title {
  flex: 1;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: var(--vb-text);
}

.task-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--vb-radius-xs);
}

.badge-info { background: var(--vb-info-bg); color: #2563eb; }
.badge-warn { background: var(--vb-warning-bg); color: #d97706; }
.badge-ok { background: var(--vb-success-bg); color: #059669; }
.badge-err { background: var(--vb-danger-bg); color: #dc2626; }
.badge-muted { background: var(--vb-bg-hover); color: var(--vb-text-tertiary); }

.task-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--vb-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.stats-left {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.task-format {
  flex-shrink: 0;
  color: var(--vb-text-tertiary);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 11px;
}

.task-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #dc2626;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
