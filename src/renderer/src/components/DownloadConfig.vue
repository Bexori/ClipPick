<template>
  <div class="panel" :class="{ muted: status === 'empty' || status === 'parsing' }">
    <div class="section-title">3. 下载配置</div>

    <!-- 未解析 -->
    <div v-if="status === 'empty'" class="config-placeholder">
      <div class="config-placeholder-icon">▰</div>
      <div>
        <div class="config-placeholder-title">请先完成视频解析</div>
        <div class="config-placeholder-desc">解析成功后可选择推荐格式、常用清晰度和保存路径。</div>
      </div>
    </div>

    <!-- 解析中骨架 -->
    <div v-else-if="status === 'parsing'" class="config-skeleton">
      <div class="format-skeleton-card"></div>
      <div class="format-skeleton-card"></div>
      <div class="format-skeleton-card"></div>
      <div class="path-row disabled">
        <span>保存到：</span>
        <span>D:\Downloads\VideoDown</span>
        <button disabled>选择路径</button>
        <button disabled>开始下载</button>
      </div>
    </div>

    <!-- 已解析 -->
    <template v-else>
      <div class="format-layout">
        <!-- 推荐卡片 -->
        <div class="recommend-card" :class="{ active: modelValue === recommendedId }" @click="$emit('update:modelValue', recommendedId)">
          <div class="recommend-label">推荐下载</div>
          <div class="recommend-title">
            {{ recommendedLabel }}
            <span>推荐</span>
          </div>
          <div class="recommend-desc">
            {{ recommendedDesc }}
          </div>
          <div class="recommend-help">
            画质清晰，兼容性好，推荐普通用户使用。
          </div>
        </div>

        <!-- 常用清晰度 -->
        <div class="common-format-box">
          <div class="format-header">常用清晰度</div>
          <div class="format-grid">
            <button
              v-for="item in commonFormats"
              :key="item.key"
              class="format-card"
              :class="{ active: modelValue === item.key }"
              @click="$emit('update:modelValue', item.key)"
            >
              <div class="format-title">{{ item.title }}</div>
              <div class="format-sub">{{ item.sub }}</div>
            </button>
          </div>
        </div>
      </div>

      <!-- 更多格式 -->
      <div class="more-format-row">
        <button class="more-format-btn">
          更多格式（共 {{ formats.length }} 个）
          <span>⌄</span>
        </button>
      </div>

      <!-- 下载操作行 -->
      <div class="download-option-row">
        <div class="select-like">
          <span>视频格式：</span>
          <strong>MP4</strong>
          <i>⌄</i>
        </div>
        <div class="select-like">
          <span>音频格式：</span>
          <strong>自动</strong>
          <i>⌄</i>
        </div>
        <div class="path-input">
          <span>保存到：</span>
          <strong :title="savePath">{{ savePath || '未设置' }}</strong>
        </div>
        <button class="sub-btn path-btn" @click="$emit('selectPath')">选择路径</button>
        <button
          class="primary-btn start-btn"
          :disabled="downloading"
          @click="$emit('download')"
        >
          <span v-if="downloading" class="mini-loading"></span>
          <span v-else>⇩</span>
          {{ downloading ? '下载中...' : '开始下载' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VideoFormat } from '../../../shared/types'

const props = defineProps<{
  status: 'empty' | 'parsing' | 'success' | 'downloading'
  formats: VideoFormat[]
  modelValue: string
  savePath: string
  downloading: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  selectPath: []
  download: []
}>()

const recommendedFormat = computed(() => {
  return props.formats.find(f => f.hasVideo && f.hasAudio && f.height >= 720)
    || props.formats.find(f => f.hasVideo && f.hasAudio)
    || props.formats[0]
})

const recommendedId = computed(() => recommendedFormat.value?.formatId ?? '')

const recommendedLabel = computed(() => {
  const f = recommendedFormat.value
  if (!f) return '--'
  if (f.height >= 2160) return '4K 超高清'
  if (f.height >= 1080) return `${f.height}P 高清`
  return `${f.height}P`
})

const recommendedDesc = computed(() => {
  const f = recommendedFormat.value
  if (!f) return ''
  return `${f.ext.toUpperCase()} · ${f.videoCodec || 'H.264'}${f.filesizeText ? ` · 约 ${f.filesizeText}` : ''}`
})

const commonFormats = computed(() => {
  const presetHeights = [2160, 1440, 1080, 720, 480, 360]
  const seen = new Set<number>()
  const result: { key: string; title: string; sub: string }[] = []

  for (const h of presetHeights) {
    const f = props.formats.find(f => f.hasVideo && f.height === h && !seen.has(h))
    if (f) {
      seen.add(h)
      result.push({
        key: f.formatId,
        title: h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}P`,
        sub: h >= 2160 ? '2160P' : h >= 1440 ? '1440P' : h >= 720 ? 'HD' : 'SD'
      })
    }
  }

  // Add audio-only option
  const audioF = props.formats.find(f => !f.hasVideo && f.hasAudio)
  if (audioF) {
    result.push({ key: audioF.formatId, title: '仅音频', sub: 'MP3' })
  }

  return result
})
</script>

<style scoped>
.panel {
  border-radius: 14px;
  padding: 16px 18px;
  background: linear-gradient(180deg, rgba(17, 31, 59, 0.92), rgba(12, 23, 44, 0.92));
  border: 1px solid rgba(96, 125, 172, 0.26);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.panel.muted {
  opacity: 0.95;
}

.section-title {
  margin-bottom: 12px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 800;
}

/* 配置空状态 */
.config-placeholder {
  min-height: 90px;
  border: 1px dashed rgba(100, 116, 139, 0.32);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #94a3b8;
  background: rgba(8, 17, 35, 0.26);
}

.config-placeholder-icon {
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

.config-placeholder-title {
  color: #f1f5f9;
  font-weight: 800;
  margin-bottom: 5px;
}

.config-placeholder-desc {
  max-width: 480px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
}

/* 解析中骨架 */
.config-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.format-skeleton-card {
  height: 58px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.09),
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.09)
  );
  background-size: 240% 100%;
  animation: shimmer 1.4s ease infinite;
}

.path-row {
  grid-column: 1 / -1;
  height: 42px;
  border-radius: 9px;
  border: 1px solid rgba(100, 116, 139, 0.24);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  color: #94a3b8;
}

.path-row button {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  color: #94a3b8;
  background: rgba(100, 116, 139, 0.16);
}

.path-row button:first-of-type {
  margin-left: auto;
}

/* 格式布局 */
.format-layout {
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 14px;
}

.recommend-card {
  min-height: 116px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(8, 17, 35, 0.45);
  border: 1px solid rgba(129, 92, 255, 0.5);
  box-shadow: inset 0 0 0 1px rgba(255, 95, 167, 0.1);
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.recommend-card.active {
  border-color: rgba(255, 95, 167, 0.88);
  box-shadow:
    0 0 0 1px rgba(255, 95, 167, 0.1),
    0 0 22px rgba(255, 95, 167, 0.12);
}

.recommend-label {
  color: #ff93c4;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
}

.recommend-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 900;
}

.recommend-title span {
  padding: 2px 7px;
  border-radius: 7px;
  color: #fed7aa;
  background: rgba(251, 146, 60, 0.2);
  font-size: 12px;
}

.recommend-desc {
  margin-top: 8px;
  color: #cbd5e1;
  font-size: 13px;
}

.recommend-help {
  margin-top: 9px;
  color: #94a3b8;
  font-size: 12px;
}

.common-format-box {
  padding: 12px;
  border-radius: 12px;
  background: rgba(8, 17, 35, 0.28);
  border: 1px solid rgba(100, 116, 139, 0.22);
}

.format-header {
  margin-bottom: 10px;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 800;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(66px, 1fr));
  gap: 8px;
}

.format-card {
  height: 58px;
  border-radius: 9px;
  color: #dbeafe;
  background: rgba(30, 41, 59, 0.75);
  border: 1px solid rgba(100, 116, 139, 0.28);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
}

.format-card:hover {
  border-color: rgba(129, 92, 255, 0.7);
}

.format-card.active {
  color: white;
  background: rgba(129, 92, 255, 0.22);
  border-color: rgba(129, 92, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(129, 92, 255, 0.1);
}

.format-title {
  font-size: 15px;
  font-weight: 900;
}

.format-sub {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 11px;
}

/* 更多格式 */
.more-format-row {
  margin-top: 10px;
}

.more-format-btn {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: 9px;
  color: #cbd5e1;
  background: rgba(8, 17, 35, 0.38);
  border: 1px solid rgba(100, 116, 139, 0.28);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.more-format-btn:hover {
  background: rgba(30, 41, 59, 0.5);
}

/* 下载操作行 */
.download-option-row {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 140px 140px 1fr 100px 130px;
  gap: 10px;
  align-items: center;
}

.select-like,
.path-input {
  height: 38px;
  padding: 0 12px;
  border-radius: 9px;
  color: #94a3b8;
  background: rgba(8, 17, 35, 0.46);
  border: 1px solid rgba(100, 116, 139, 0.3);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  overflow: hidden;
}

.select-like strong,
.path-input strong {
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-like i {
  margin-left: auto;
  font-style: normal;
  color: #94a3b8;
}

.sub-btn,
.primary-btn {
  height: 38px;
  border-radius: 9px;
  color: #e2e8f0;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sub-btn {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(100, 116, 139, 0.36);
}

.sub-btn:hover {
  background: rgba(51, 65, 85, 0.9);
}

.primary-btn {
  background: linear-gradient(135deg, #ff5fa7, #815cff);
  color: white;
  box-shadow: 0 10px 22px rgba(255, 95, 167, 0.2);
}

.primary-btn:hover {
  filter: brightness(1.06);
}

.primary-btn:disabled {
  opacity: 0.45;
  filter: grayscale(0.2);
  box-shadow: none;
}

.mini-loading {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-top-color: #ffffff;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
</style>
