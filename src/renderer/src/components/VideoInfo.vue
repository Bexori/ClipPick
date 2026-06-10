<template>
  <div v-if="info" class="video-info-card">
    <div class="vi-thumb">
      <el-image :src="info.thumbnail" fit="cover" class="thumb-img">
        <template #error>
          <div class="thumb-fallback">
            <el-icon :size="32"><VideoCamera /></el-icon>
          </div>
        </template>
      </el-image>
      <div class="duration-tag" v-if="info.duration">
        {{ formatDuration(info.duration) }}
      </div>
    </div>

    <div class="vi-body">
      <h3 class="vi-title">{{ info.title }}</h3>

      <div class="vi-meta">
        <span class="meta-item">
          <el-icon><User /></el-icon>
          {{ info.uploader || '未知' }}
        </span>
        <span class="meta-sep"></span>
        <span class="meta-item">
          <el-icon><Film /></el-icon>
          {{ info.formats.length }} 个格式
        </span>
      </div>

      <p v-if="info.description" class="vi-desc">
        {{ info.description.slice(0, 160) }}{{ info.description.length > 160 ? '...' : '' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Film, User, VideoCamera } from "@element-plus/icons-vue";
import type { VideoParseResult } from "../../../shared/types";

defineProps<{
  info: VideoParseResult;
}>();

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<style scoped>
.video-info-card {
  display: flex;
  gap: 20px;
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 20px;
  margin-bottom: 16px;
}

.vi-thumb {
  position: relative;
  width: 240px;
  flex-shrink: 0;
  border-radius: var(--vb-radius-sm);
  overflow: hidden;
}

.thumb-img {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
}

.thumb-fallback {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
}

.duration-tag {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
}

.vi-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vi-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vb-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.vi-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--vb-text-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--vb-text-tertiary);
}

.vi-desc {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
