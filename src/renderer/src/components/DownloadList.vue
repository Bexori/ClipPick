<template>
  <el-card class="download-list-card">
    <template #header>
      <div class="card-header">
        <span>下载队列</span>
        <span class="sub-text">{{ tasks.length }} 个任务</span>
      </div>
    </template>
    <div v-if="tasks.length === 0" class="empty-state">
      <el-icon :size="40"><VideoPlay /></el-icon>
      <p>暂无下载任务</p>
    </div>
    <div v-else>
      <DownloadProgress
        v-for="task in tasks"
        :key="task.taskId"
        :task="task"
        @cancel="handleCancel"
        @open-folder="handleOpenFolder"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { VideoPlay } from "@element-plus/icons-vue";
import DownloadProgress from "./DownloadProgress.vue";
import type { DownloadTask } from "../../../shared/types";
import { useDownloadStore } from "../stores/download.store";

defineProps<{
  tasks: DownloadTask[];
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
.download-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.sub-text {
  color: #909399;
  font-size: 12px;
  font-weight: 400;
}

.empty-state {
  padding: 40px 0;
  color: #c0c4cc;
  text-align: center;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
</style>
