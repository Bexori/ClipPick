<template>
  <div class="dl-list">
    <div class="dl-header">
      <h3 class="dl-title">下载队列</h3>
      <span class="dl-count">{{ tasks.length }} 个任务</span>
    </div>

    <div v-if="tasks.length === 0" class="dl-empty">
      <el-icon :size="36"><VideoPlay /></el-icon>
      <p>暂无下载任务</p>
    </div>

    <div v-else>
      <DownloadProgress
        v-for="task in tasks"
        :key="task.taskId"
        :task="task"
        @cancel="handleCancel"
        @retry="$emit('retry', $event)"
        @remove="store.removeTask($event)"
        @open-folder="handleOpenFolder"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { VideoPlay } from "@element-plus/icons-vue";
import DownloadProgress from "./DownloadProgress.vue";
import type { DownloadTask } from "../../../shared/types";
import { useDownloadStore } from "../stores/download.store";

defineProps<{
  tasks: DownloadTask[];
}>();

defineEmits<{
  retry: [taskId: string];
}>();

const store = useDownloadStore();

async function handleCancel(taskId: string) {
  await window.api.cancelDownload(taskId);
  store.updateTask(taskId, { status: "cancelled" });
}

function handleOpenFolder(taskId: string) {
  const task = store.tasks.find((item) => item.taskId === taskId);
  if (task) {
    window.api.openFileInFolder(task.outputDir);
  }
}
</script>

<style scoped>
.dl-list {
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 20px;
}

.dl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dl-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vb-text);
}

.dl-count {
  font-size: 12px;
  color: var(--vb-text-tertiary);
}

.dl-empty {
  text-align: center;
  padding: 32px 0;
  color: var(--vb-text-tertiary);
}
.dl-empty p {
  margin-top: 10px;
  font-size: 13px;
}
</style>
