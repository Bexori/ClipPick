<template>
  <div class="panel task-panel">
    <div class="section-title">4. 当前任务</div>

    <!-- 空状态 -->
    <div v-if="!task" class="task-placeholder">
      <div class="task-placeholder-icon">▣</div>
      <div>
        <div class="task-placeholder-title">当前暂无下载任务</div>
        <div class="task-placeholder-desc">开始下载后，任务进度会显示在这里。</div>
      </div>
    </div>

    <!-- 有任务 -->
    <template v-else>
      <div class="task-card">
        <div class="mini-cover"></div>

        <div class="task-main">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-sub">{{ task.formatLabel }} · {{ formatBytes(task.totalBytes) }}</div>
          <div class="progress-line">
            <div class="progress-inner" :style="{ width: task.progress + '%' }" :class="progressClass"></div>
          </div>
        </div>

        <div class="task-progress-text" :class="{ 'is-done': task.status === 'completed' }">
          {{ task.status === 'completed' ? '✓' : task.progress + '%' }}
        </div>

        <div class="task-speed">
          <div v-if="task.speed">{{ task.speed }}</div>
          <span v-if="task.eta">剩余 {{ task.eta }}</span>
        </div>

        <div class="task-actions">
          <button v-if="task.status === 'downloading'" @click="$emit('cancel', task.taskId)" title="暂停">Ⅱ</button>
          <button v-if="task.status === 'completed'" @click="$emit('openFolder', task.taskId)" title="打开位置">📂</button>
          <button @click="$emit('remove', task.taskId)" title="移除">×</button>
        </div>
      </div>

      <div v-if="task.status === 'downloading'" class="task-summary">
        <span>下载速度：{{ task.speed || '--' }}</span>
        <span>总进度：{{ task.progress }}%</span>
        <span>剩余时间：{{ task.eta || '--' }}</span>
        <button @click="$emit('cancelAll')">全部暂停</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DownloadTask } from '../../../shared/types'

const props = defineProps<{
  task: DownloadTask | null
}>()

defineEmits<{
  cancel: [taskId: string]
  remove: [taskId: string]
  openFolder: [taskId: string]
  cancelAll: []
}>()

const progressClass = computed(() => {
  if (!props.task) return ''
  if (props.task.status === 'error') return 'is-error'
  if (props.task.status === 'completed') return 'is-done'
  if (props.task.status === 'post-processing') return 'is-indeterminate'
  return ''
})

function formatBytes(bytes: number): string {
  if (!bytes) return '--'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}
</script>

<style scoped>
.panel {
  border-radius: 14px;
  padding: 16px 18px;
  background: linear-gradient(180deg, rgba(17, 31, 59, 0.92), rgba(12, 23, 44, 0.92));
  border: 1px solid rgba(96, 125, 172, 0.26);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.task-panel {
  min-height: 130px;
}

.section-title {
  margin-bottom: 12px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 800;
}

/* 空状态 */
.task-placeholder {
  min-height: 80px;
  border: 1px dashed rgba(100, 116, 139, 0.32);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #94a3b8;
  background: rgba(8, 17, 35, 0.26);
}

.task-placeholder-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: rgba(129, 92, 255, 0.16);
  border: 1px solid rgba(129, 92, 255, 0.28);
  color: #d8b4fe;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.task-placeholder-title {
  color: #f1f5f9;
  font-weight: 800;
  margin-bottom: 5px;
}

.task-placeholder-desc {
  max-width: 480px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
}

/* 任务卡片 */
.task-card {
  min-height: 80px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(8, 17, 35, 0.38);
  border: 1px solid rgba(100, 116, 139, 0.26);
  display: grid;
  grid-template-columns: 72px 1fr 48px 100px 80px;
  gap: 14px;
  align-items: center;
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
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-sub {
  margin-top: 5px;
  color: #94a3b8;
  font-size: 12px;
}

.progress-line {
  position: relative;
  height: 7px;
  margin-top: 9px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.16);
}

.progress-inner {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #815cff, #ff5fa7);
  transition: width 0.3s ease;
}

.progress-inner.is-done {
  background: #22c55e;
}

.progress-inner.is-error {
  background: #ef4444;
}

.progress-inner.is-indeterminate {
  width: 100% !important;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.task-progress-text {
  color: #ff75b5;
  font-weight: 900;
  font-size: 15px;
}

.task-progress-text.is-done {
  color: #4ade80;
}

.task-speed {
  color: #e2e8f0;
  font-size: 13px;
}

.task-speed span {
  display: block;
  margin-top: 5px;
  color: #94a3b8;
  font-size: 12px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-actions button {
  width: 32px;
  height: 32px;
  color: #cbd5e1;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.88);
  border: 1px solid rgba(100, 116, 139, 0.26);
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-actions button:hover {
  background: rgba(51, 65, 85, 0.9);
}

/* 汇总栏 */
.task-summary {
  margin-top: 10px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 12px;
  color: #94a3b8;
  font-size: 13px;
  border-radius: 10px;
  background: rgba(8, 17, 35, 0.26);
  border: 1px solid rgba(100, 116, 139, 0.2);
}

.task-summary button {
  margin-left: auto;
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.86);
  border: 1px solid rgba(100, 116, 139, 0.3);
}
</style>
