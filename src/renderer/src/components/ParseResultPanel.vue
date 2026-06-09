<template>
  <div class="panel result-panel">
    <div class="section-title">2. 解析结果</div>

    <!-- 空状态 -->
    <div v-if="status === 'empty'" class="placeholder-box">
      <div class="placeholder-icon">▱</div>
      <div>
        <div class="placeholder-title">暂无解析结果</div>
        <div class="placeholder-desc">
          粘贴视频链接并点击"解析视频"，系统将自动获取视频标题、封面和可用清晰度。
        </div>
      </div>
    </div>

    <!-- 解析中 -->
    <div v-else-if="status === 'parsing'" class="parsing-box">
      <div class="loading-header">
        <span class="big-loading"></span>
        <div>
          <div class="loading-main">正在解析视频信息</div>
          <div class="loading-sub">请稍候，系统正在获取视频标题、封面和可用清晰度...</div>
        </div>
      </div>

      <div class="skeleton-row">
        <div class="skeleton-cover"></div>
        <div class="skeleton-info">
          <div class="skeleton-line wide"></div>
          <div class="skeleton-meta">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-dot"></div>
            <div class="skeleton-line medium"></div>
          </div>
          <div class="skeleton-meta">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-dot"></div>
            <div class="skeleton-line medium"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 解析成功 / 下载中 -->
    <div v-else-if="videoInfo" class="video-info">
      <div class="cover-box">
        <div class="fake-cover">
          <div class="cover-sky"></div>
          <div class="cover-light"></div>
          <div class="cover-person"></div>
          <div class="duration">{{ formatDuration(videoInfo.duration) }}</div>
        </div>
      </div>

      <div class="video-meta">
        <h2>{{ videoInfo.title }}</h2>
        <div class="meta-row">
          <span>👤 {{ videoInfo.uploader }}</span>
          <span v-if="videoInfo.uploadDate">◷ {{ videoInfo.uploadDate }}</span>
          <span v-if="videoInfo.viewCount">◎ {{ formatViewCount(videoInfo.viewCount) }} 次观看</span>
        </div>
        <p v-if="videoInfo.description" class="video-desc">
          {{ videoInfo.description.slice(0, 200) }}{{ videoInfo.description.length > 200 ? '...' : '' }}
        </p>
        <div class="tag-row">
          <span class="tag">解析成功</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VideoParseResult } from '../../../shared/types'

defineProps<{
  status: 'empty' | 'parsing' | 'success' | 'downloading'
  videoInfo: VideoParseResult | null
}>()

function formatDuration(seconds: number): string {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViewCount(n: number): string {
  if (!n) return '--'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`
  return String(n)
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

.result-panel {
  min-height: 170px;
}

.section-title {
  margin-bottom: 12px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 800;
}

/* 空状态 & 占位 */
.placeholder-box {
  min-height: 130px;
  border: 1px dashed rgba(100, 116, 139, 0.32);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #94a3b8;
  background: rgba(8, 17, 35, 0.26);
}

.placeholder-icon {
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

.placeholder-title {
  color: #f1f5f9;
  font-weight: 800;
  margin-bottom: 5px;
}

.placeholder-desc {
  max-width: 480px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
}

/* 解析中 */
.parsing-box {
  min-height: 160px;
  padding: 12px 18px 18px;
  border: 1px solid rgba(100, 116, 139, 0.26);
  border-radius: 12px;
  background: rgba(8, 17, 35, 0.22);
}

.loading-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 20px;
}

.big-loading {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.16);
  border-top-color: #ff5fa7;
  animation: spin 0.9s linear infinite;
}

.loading-main {
  color: #f8fafc;
  font-size: 18px;
  font-weight: 800;
}

.loading-sub {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 13px;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 22px;
  align-items: center;
}

.skeleton-cover,
.skeleton-line,
.skeleton-dot {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.09),
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.09)
  );
  background-size: 240% 100%;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-cover {
  height: 96px;
  border-radius: 10px;
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skeleton-line {
  height: 16px;
  border-radius: 99px;
}

.skeleton-line.wide { width: 82%; }
.skeleton-line.short { width: 160px; }
.skeleton-line.medium { width: 230px; }

.skeleton-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
}

/* 视频信息 */
.video-info {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 22px;
  align-items: center;
}

.fake-cover {
  position: relative;
  height: 136px;
  border-radius: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at 64% 30%, rgba(255, 146, 198, 0.75), transparent 24%),
    linear-gradient(135deg, #2a145d, #111827 55%, #060914);
}

.cover-sky {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(129, 92, 255, 0.25), transparent),
    radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.28), transparent 12%);
}

.cover-light {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 52%;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.55), transparent);
}

.cover-person {
  position: absolute;
  left: 58px;
  bottom: 24px;
  width: 70px;
  height: 70px;
  border-radius: 44% 44% 12px 12px;
  background: linear-gradient(180deg, #f4a7c8, #34224d);
  opacity: 0.8;
}

.duration {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.58);
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.video-meta h2 {
  margin: 0 0 10px;
  font-size: 18px;
  line-height: 1.35;
  color: #f8fafc;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: #aebbd0;
  font-size: 13px;
}

.video-desc {
  margin: 10px 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag {
  padding: 3px 8px;
  border-radius: 7px;
  font-size: 12px;
  color: #86efac;
  background: rgba(34, 197, 94, 0.16);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
</style>
