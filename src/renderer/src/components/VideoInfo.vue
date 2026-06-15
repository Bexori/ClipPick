<template>
  <div v-if="info" class="video-info-card">
    <div class="video-info-main">
      <div class="vi-thumb">
        <el-image :src="info.thumbnail" fit="cover" class="thumb-img">
          <template #error>
            <div class="thumb-fallback">
              <el-icon :size="32"><VideoCamera /></el-icon>
            </div>
          </template>
        </el-image>
        <div v-if="info.duration" class="duration-tag">
          {{ formatDuration(info.duration) }}
        </div>
      </div>

      <div class="vi-body">
        <h3 class="vi-title">{{ info.title }}</h3>

        <div class="vi-meta">
          <span class="meta-item">
            <el-icon><User /></el-icon>
            {{ info.uploader || "未知" }}
          </span>
          <span class="meta-sep"></span>
          <span class="meta-item">
            <el-icon><Film /></el-icon>
            {{ info.formats.length }} 个格式
          </span>
        </div>

        <div v-if="info.description" class="vi-desc">
          <p class="vi-desc-preview">{{ descriptionPreview }}</p>
          <div class="desc-actions">
            <button
              v-if="info.description.length > descriptionLimit"
              type="button"
              class="desc-toggle"
              @click="descriptionExpanded = !descriptionExpanded"
            >
              {{ descriptionExpanded ? '收起' : '展开' }}
            </button>
            <button
              type="button"
              class="translate-toggle"
              :disabled="translating"
              @click="handleTranslate"
            >
              {{ translating ? '翻译中' : (translatedText ? '重新翻译' : '翻译') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="descriptionExpanded && info.description" class="vi-desc-full">
      <div class="full-desc-head">
        <span>{{ translatedText ? '翻译结果' : '完整简介' }}</span>
        <button v-if="translatedText" type="button" class="source-toggle" @click="showTranslated = !showTranslated">
          {{ showTranslated ? '查看原文' : '查看翻译' }}
        </button>
      </div>
      <p class="full-desc-text">{{ showTranslated && translatedText ? translatedText : info.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from 'element-plus'
import { Film, User, VideoCamera } from "@element-plus/icons-vue";
import type { VideoParseResult } from "../../../shared/types";
import { useSettingsStore } from "../stores/settings.store";

const props = defineProps<{
  info: VideoParseResult;
}>();

const settingsStore = useSettingsStore()
const descriptionLimit = 120;
const descriptionExpanded = ref(false);
const translating = ref(false)
const translatedText = ref('')
const showTranslated = ref(true)

const normalizedDescription = computed(() =>
  normalizeDescription(props.info.description || ""),
);

const descriptionPreview = computed(() => {
  const text = normalizedDescription.value;
  if (text.length <= descriptionLimit) return text;
  return `${text.slice(0, descriptionLimit).trimEnd()}...`;
});

watch(
  () => [props.info.title, props.info.description],
  () => {
    descriptionExpanded.value = false;
    translatedText.value = ''
    showTranslated.value = true
  },
);

function normalizeDescription(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00A0]+/g, " ").trim())
    .join("\n")
    .trim();
}

async function handleTranslate() {
  if (!props.info.description) return

  translating.value = true
  try {
    if (!settingsStore.loaded) {
      await settingsStore.loadFromLocal()
    }

    const result = await window.api.translateText({
      text: props.info.description,
      profileId: settingsStore.activeProfileId || settingsStore.translateProfiles[0]?.id
    })

    translatedText.value = result.translatedText
    showTranslated.value = true
    descriptionExpanded.value = true
  } catch (err) {
    translatedText.value = ''
    const message = err instanceof Error ? err.message : '翻译失败'
    ElMessage.warning(message)
  } finally {
    translating.value = false
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
</script>

<style scoped>
.video-info-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  padding: 18px;
  margin-bottom: 16px;
}

.video-info-main {
  display: flex;
  align-items: stretch;
  gap: 18px;
  min-width: 0;
  height: 135px;
}

.vi-thumb {
  position: relative;
  width: 240px;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
  border-radius: var(--vb-radius-sm);
}

.thumb-img {
  width: 100%;
  height: 100%;
  display: block;
}

.thumb-fallback {
  width: 100%;
  height: 100%;
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
  background: rgba(0, 0, 0, 0.82);
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
  gap: 8px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.vi-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
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
  min-width: 0;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.meta-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--vb-text-tertiary);
  flex-shrink: 0;
}

.vi-desc {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.desc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.vi-desc-preview {
  margin: 0;
  font-size: 12px;
  color: var(--vb-text-tertiary);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

.desc-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.06);
  color: var(--vb-accent);
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  transition: background var(--vb-transition), border-color var(--vb-transition), color var(--vb-transition);
}

.desc-toggle:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.26);
}

.translate-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--vb-border-light);
  border-radius: 999px;
  background: var(--vb-bg-surface);
  color: var(--vb-text-secondary);
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  transition: border-color var(--vb-transition), background var(--vb-transition), color var(--vb-transition);
}

.translate-toggle:hover:not(:disabled) {
  border-color: rgba(99, 102, 241, 0.26);
  background: rgba(99, 102, 241, 0.06);
  color: var(--vb-accent);
}

.translate-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.source-toggle {
  align-self: flex-start;
  padding: 0 10px;
  border: 1px solid var(--vb-border-light);
  border-radius: 999px;
  background: var(--vb-bg-surface);
  color: var(--vb-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  min-height: 28px;
}

.source-toggle:hover {
  border-color: rgba(99, 102, 241, 0.26);
  color: var(--vb-accent);
}

.vi-desc-full {
  padding-top: 12px;
  border-top: 1px solid var(--vb-border-light);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.full-desc-text {
  margin: 0;
  font-size: 12px;
  color: var(--vb-text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .video-info-main {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
  }

  .vi-thumb {
    width: 100%;
    max-width: 320px;
    height: auto;
  }

  .thumb-img,
  .thumb-fallback {
    aspect-ratio: 16 / 9;
    height: auto;
  }

  .vi-body {
    height: auto;
    overflow: visible;
  }

  .vi-desc {
    overflow: visible;
  }
}
</style>
