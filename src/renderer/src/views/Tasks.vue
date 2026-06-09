<template>
  <div class="tasks-page">
    <div class="page-header">
      <h2>下载任务</h2>
      <div class="header-actions">
        <span class="task-count">{{ tasks.length }} 个任务</span>
        <button v-if="activeCount > 0" class="action-btn" @click="handleCancelAll">全部暂停</button>
        <button v-if="completedCount > 0" class="action-btn" @click="handleClearCompleted">清除已完成</button>
      </div>
    </div>

    <div v-if="tasks.length === 0" class="empty-box">
      <div class="empty-icon">▤</div>
      <div class="empty-title">暂无下载任务</div>
      <div class="empty-desc">在"视频下载"页面添加下载任务后，任务会显示在这里。</div>
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in tasks"
        :key="task.taskId"
        class="task-card"
      >
        <div class="mini-cover"></div>
        <div class="task-main">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <span class="format-tag">{{ task.formatLabel }}</span>
            <el-tag :type="statusTagType(task.status)" size="small">{{ statusText(task.status) }}</el-tag>
          </div>
          <div v-if="task.status === 'downloading' || task.status === 'post-processing'" class="progress-line">
            <div
              class="progress-inner"
              :class="{ indeterminate: task.status === 'post-processing' }"
              :style="{ width: task.status === 'post-processing' ? '100%' : task.progress + '%' }"
            ></div>
          </div>
        </div>
        <div class="task-stats">
          <div v-if="task.speed">{{ task.speed }}</div>
          <div v-if="task.eta">剩余 {{ task.eta }}</div>
          <div v-if="task.totalBytes > 0">{{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}</div>
        </div>
        <div class="task-actions">
          <button v-if="task.status === 'error'" class="retry-btn" @click="handleRetry(task)">重试</button>
          <button
            v-if="task.status === 'downloading'"
            @click="handleCancel(task.taskId)"
            title="取消"
          >取消</button>
          <button
            v-if="task.status === 'completed'"
            @click="handleOpenFolder(task.taskId)"
            title="打开位置"
          >📂</button>
          <button
            v-if="task.status !== 'downloading'"
            @click="handleRemove(task.taskId)"
            title="移除"
          >删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useDownloadStore } from '../stores/download.store'
import type { DownloadTask } from '../../../shared/types'

const store = useDownloadStore()

const tasks = computed(() => store.tasks)
const activeCount = computed(() => store.activeTasks.length)
const completedCount = computed(() => store.tasks.filter(t => t.status === 'completed').length)

function statusTagType(status: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = {
    queued: 'info',
    downloading: '',
    'post-processing': 'warning',
    completed: 'success',
    cancelled: 'info',
    error: 'danger'
  }
  return map[status] ?? 'info'
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    queued: '排队中',
    downloading: '下载中',
    'post-processing': '处理中',
    completed: '已完成',
    cancelled: '已取消',
    error: '失败'
  }
  return map[status] ?? status
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

async function handleCancel(taskId: string) {
  await window.api.cancelDownload(taskId)
  store.updateTask(taskId, { status: 'cancelled' })
}

function handleRemove(taskId: string) {
  store.removeTask(taskId)
}

function handleOpenFolder(taskId: string) {
  const task = store.tasks.find(t => t.taskId === taskId)
  if (task) window.api.openFileInFolder(task.outputDir)
}

function handleRetry(task: DownloadTask) {
  store.updateTask(task.taskId, { status: 'queued', progress: 0, error: undefined })
  ElMessage.info('任务已重新加入队列')
}

async function handleCancelAll() {
  for (const t of store.activeTasks) {
    await window.api.cancelDownload(t.taskId)
    store.updateTask(t.taskId, { status: 'cancelled' })
  }
}

function handleClearCompleted() {
  store.tasks
    .filter(t => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error')
    .forEach(t => store.removeTask(t.taskId))
}
</script>

<style scoped>
.tasks-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #f8fafc;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-count {
  color: #94a3b8;
  font-size: 13px;
}

.action-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.86);
  border: 1px solid rgba(100, 116, 139, 0.3);
  font-size: 13px;
}

.action-btn:hover {
  background: rgba(51, 65, 85, 0.9);
}

/* 空状态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #94a3b8;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(129, 92, 255, 0.16);
  border: 1px solid rgba(129, 92, 255, 0.28);
  color: #d8b4fe;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
}

.empty-title {
  color: #f1f5f9;
  font-weight: 800;
  font-size: 18px;
  margin-bottom: 8px;
}

.empty-desc {
  max-width: 400px;
  font-size: 13px;
  line-height: 1.6;
}

/* 任务列表 */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  display: grid;
  grid-template-columns: 72px 1fr 160px 100px;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(17, 31, 59, 0.92), rgba(12, 23, 44, 0.92));
  border: 1px solid rgba(96, 125, 172, 0.26);
}

.mini-cover {
  width: 72px;
  height: 44px;
  border-radius: 7px;
  background:
    radial-gradient(circle at 70% 24%, rgba(255, 95, 167, 0.78), transparent 22%),
    linear-gradient(135deg, #2a145d, #111827);
}

.task-title {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.format-tag {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(100, 116, 139, 0.16);
  padding: 2px 6px;
  border-radius: 4px;
}

.progress-line {
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.16);
  margin-top: 6px;
}

.progress-inner {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #815cff, #ff5fa7);
  transition: width 0.3s ease;
}

.progress-inner.indeterminate {
  width: 100% !important;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.task-stats {
  color: #94a3b8;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.task-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.task-actions button {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(100, 116, 139, 0.3);
  font-size: 12px;
}

.task-actions button:hover {
  background: rgba(51, 65, 85, 0.9);
}

.retry-btn {
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.3) !important;
}
</style>
