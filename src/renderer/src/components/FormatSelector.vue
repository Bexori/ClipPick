<template>
  <div class="format-selector">
    <div class="format-group">
      <div class="group-label">推荐</div>
      <div class="format-grid">
        <div
          v-for="format in recommendedFormats"
          :key="format.formatId"
          class="format-chip"
          :class="{ selected: modelValue === format.formatId }"
          @click="$emit('update:modelValue', format.formatId)"
        >
          <span class="chip-badge" :class="format.height >= 1080 ? 'badge-high' : format.height >= 720 ? 'badge-mid' : 'badge-low'">
            {{ format.height >= 2160 ? '4K' : `${format.height}p` }}
          </span>
          <span class="chip-ext">{{ format.ext.toUpperCase() }}</span>
          <span v-if="format.fps >= 50" class="chip-fps">{{ format.fps }}fps</span>
          <span v-if="format.filesizeText && format.filesizeText !== '未知大小'" class="chip-size">~{{ format.filesizeText }}</span>
          <span v-if="format.note" class="chip-note">{{ format.note }}</span>
        </div>
      </div>
    </div>

    <div v-if="audioFormats.length" class="format-group">
      <div class="group-label">仅音频</div>
      <div class="format-grid">
        <div
          v-for="format in audioFormats"
          :key="format.formatId"
          class="format-chip chip-audio"
          :class="{ selected: modelValue === format.formatId }"
          @click="$emit('update:modelValue', format.formatId)"
        >
          <span class="chip-badge badge-audio">音频</span>
          <span class="chip-ext">{{ format.ext.toUpperCase() }}</span>
          <span v-if="format.filesizeText && format.filesizeText !== '未知大小'" class="chip-size">~{{ format.filesizeText }}</span>
          <span v-if="format.abr" class="chip-note">{{ format.abr }}kbps</span>
        </div>
      </div>
    </div>

    <details v-if="otherFormats.length" class="format-group all-group">
      <summary class="group-label group-toggle">全部格式 ({{ otherFormats.length }})</summary>
      <div class="format-grid">
        <div
          v-for="format in otherFormats"
          :key="format.formatId"
          class="format-chip"
          :class="{ selected: modelValue === format.formatId }"
          @click="$emit('update:modelValue', format.formatId)"
        >
          <span class="chip-badge" :class="format.height >= 1080 ? 'badge-high' : format.height >= 720 ? 'badge-mid' : format.hasVideo ? 'badge-low' : 'badge-audio'">
            {{ format.height > 0 ? `${format.height}p` : format.ext.toUpperCase() }}
          </span>
          <span class="chip-ext">{{ format.ext.toUpperCase() }}</span>
          <span v-if="format.fps >= 50" class="chip-fps">{{ format.fps }}fps</span>
          <span v-if="format.filesizeText && format.filesizeText !== '未知大小'" class="chip-size">~{{ format.filesizeText }}</span>
          <span v-if="format.note" class="chip-note">{{ format.note }}</span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { VideoFormat } from "../../../shared/types";

const props = defineProps<{
  formats: VideoFormat[];
  modelValue: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

const recommendedFormats = computed(() => {
  return props.formats.filter((format) => {
    return format.hasVideo && format.hasAudio && format.height >= 360;
  });
});

const audioFormats = computed(() => {
  return props.formats.filter((format) => {
    return !format.hasVideo && format.hasAudio;
  });
});

const otherFormats = computed(() => {
  return props.formats.filter((format) => {
    return (
      !recommendedFormats.value.includes(format) &&
      !audioFormats.value.includes(format)
    );
  });
});
</script>

<style scoped>
.format-selector {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.format-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.group-toggle {
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.group-toggle::-webkit-details-marker {
  display: none;
}

.group-toggle::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.2s;
}

details[open] .group-toggle::before {
  transform: rotate(90deg);
}

.format-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.format-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 2px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #fff;
  font-size: 13px;
}

.format-chip:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.format-chip.selected {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff;
}

.chip-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.badge-high {
  background: #fdf6ec;
  color: #e6a23c;
}

.badge-mid {
  background: #ecf5ff;
  color: #409eff;
}

.badge-low {
  background: #f0f9eb;
  color: #67c23a;
}

.badge-audio {
  background: #fef0f0;
  color: #f56c6c;
}

.chip-ext {
  font-weight: 600;
  color: #303133;
  font-size: 12px;
}

.chip-fps {
  font-size: 11px;
  color: #e6a23c;
  font-weight: 500;
}

.chip-size {
  font-size: 11px;
  color: #909399;
}

.chip-note {
  font-size: 11px;
  color: #909399;
}

.chip-audio .chip-ext {
  color: #f56c6c;
}
</style>
