<template>
  <div class="download-bar-wrapper">
    <div class="download-bar-inner">
      <div class="bar-header" @click="collapsed = !collapsed">
        <div class="bar-title">
          <el-icon :size="16" class="pulse-icon"><Download /></el-icon>
          <span>下载队列</span>
          <span class="bar-count">{{ tasks.length }}</span>
        </div>
        <el-icon :class="{ rotated: !collapsed }" class="toggle-icon"><ArrowUp /></el-icon>
      </div>
      <div v-show="!collapsed" class="bar-body">
        <DownloadProgress
          v-for="task in activeTasks"
          :key="task.taskId"
          :task="task"
          @cancel="handleCancel"
          @open-folder="handleOpenFolder"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUp, Download } from '@element-plus/icons-vue'
import DownloadProgress from './DownloadProgress.vue'
import type { DownloadTask } from '../../../shared/types'
import { useDownloadStore } from '../stores/download.store'

const props = defineProps<{
  tasks: DownloadTask[]
}>()

const store = useDownloadStore()
const collapsed = ref(false)

const activeTasks = computed(() => {
  return props.tasks.filter(t => t.status !== 'completed' && t.status !== 'error')
})

async function handleCancel(taskId: string) {
  await window.api.cancelDownload(taskId)
  store.updateTask(taskId, { status: 'cancelled' })
}

function handleOpenFolder(taskId: string) {
  const task = store.tasks.find((item) => item.taskId === taskId)
  if (task) {
    window.api.openFileInFolder(task.outputDir)
  }
}
</script>

<style scoped>
.download-bar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  border-top: 2px solid #409eff;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  max-height: 40vh;
}

.download-bar-inner {
  padding: 0 16px;
}

.bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
  user-select: none;
}

.bar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.pulse-icon {
  color: #409eff;
}

.bar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.toggle-icon {
  color: #909399;
  transition: transform 0.2s ease;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.bar-body {
  padding-bottom: 8px;
  overflow-y: auto;
  max-height: calc(40vh - 40px);
}
</style>
