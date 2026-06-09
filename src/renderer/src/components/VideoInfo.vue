<template>
  <el-card v-if="info" class="video-info-card">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-image
          :src="info.thumbnail"
          fit="cover"
          style="width: 100%; aspect-ratio: 16/9; border-radius: 8px"
        >
          <template #error>
            <div class="image-placeholder">
              <el-icon :size="40"><VideoCamera /></el-icon>
            </div>
          </template>
        </el-image>
      </el-col>
      <el-col :span="16">
        <h3 class="video-title">{{ info.title }}</h3>
        <div class="video-meta">
          <div class="meta-item">
            <el-icon><User /></el-icon>
            <span>{{ info.uploader }}</span>
          </div>
          <div class="meta-item">
            <el-icon><Timer /></el-icon>
            <span>{{ formatDuration(info.duration) }}</span>
          </div>
          <div class="meta-item">
            <el-icon><Film /></el-icon>
            <span>{{ info.formats.length }} 个可用格式</span>
          </div>
        </div>
        <p v-if="info.description" class="video-desc">
          {{ info.description.slice(0, 200) }}{{ info.description.length > 200 ? "..." : "" }}
        </p>
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup lang="ts">
import { Film, Timer, User, VideoCamera } from "@element-plus/icons-vue";
import type { VideoParseResult } from "../../../shared/types";

defineProps<{
  info: VideoParseResult;
}>();

function formatDuration(seconds: number): string {
  if (!seconds) return "--";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}
</script>

<style scoped>
.video-info-card {
  margin-bottom: 16px;
}

.video-title {
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.video-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
  color: #909399;
  font-size: 13px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-desc {
  color: #c0c4cc;
  font-size: 12px;
  line-height: 1.5;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 8px;
  background: #f0f2f5;
  color: #c0c4cc;
}
</style>
