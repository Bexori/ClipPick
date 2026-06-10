<template>
  <div class="format-picker">
    <div class="format-grid">
      <button
        v-for="option in primaryOptions"
        :key="option.value"
        type="button"
        class="format-card"
        :class="{ active: modelValue === option.value }"
        @click="select(option.value)"
      >
        <span class="format-name">{{ option.name }}</span>
        <span class="format-meta">{{ option.meta }}</span>
      </button>
    </div>

    <el-collapse-transition>
      <div v-if="showAdvanced" class="advanced-panel">
        <el-select
          :model-value="modelValue"
          filterable
          placeholder="选择更多格式"
          class="advanced-select"
          @update:model-value="select"
        >
          <el-option
            v-for="format in formats"
            :key="format.formatId"
            :label="formatLabel(format)"
            :value="format.formatId"
          />
        </el-select>
      </div>
    </el-collapse-transition>

    <button type="button" class="advanced-toggle" @click="showAdvanced = !showAdvanced">
      {{ showAdvanced ? '收起更多格式' : '更多格式' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { VideoFormat } from '../../../shared/types'

const props = defineProps<{
  formats: VideoFormat[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showAdvanced = ref(false)

const primaryOptions = computed(() => {
  const options = [
    buildOption('最佳画质', findBestVideo()),
    buildOption('1080p', findByHeight(1080)),
    buildOption('720p', findByHeight(720)),
    buildOption('仅音频', findBestAudio())
  ].filter((item): item is { name: string; value: string; meta: string } => Boolean(item))

  const seen = new Set<string>()
  return options.filter((item) => {
    if (seen.has(item.value)) return false
    seen.add(item.value)
    return true
  })
})

function select(value: string) {
  emit('update:modelValue', value)
}

function buildOption(name: string, format?: VideoFormat) {
  if (!format) return null
  return {
    name,
    value: format.formatId,
    meta: formatSummary(format)
  }
}

function findBestVideo(): VideoFormat | undefined {
  return [...props.formats]
    .filter(format => format.hasVideo && format.hasAudio)
    .sort((a, b) => b.height - a.height || b.filesize - a.filesize)[0]
}

function findByHeight(height: number): VideoFormat | undefined {
  return [...props.formats]
    .filter(format => format.hasVideo && format.hasAudio && format.height <= height)
    .sort((a, b) => b.height - a.height || b.filesize - a.filesize)[0]
}

function findBestAudio(): VideoFormat | undefined {
  return [...props.formats]
    .filter(format => !format.hasVideo && format.hasAudio)
    .sort((a, b) => b.audioBitrate - a.audioBitrate || b.filesize - a.filesize)[0]
}

function formatSummary(format: VideoFormat): string {
  const parts = []
  if (format.height > 0) parts.push(`${format.height}p`)
  else parts.push('音频')
  parts.push(format.ext.toUpperCase())
  if (format.filesizeText && format.filesizeText !== '未知大小') parts.push(format.filesizeText)
  return parts.join(' · ')
}

function formatLabel(format: VideoFormat): string {
  const bits = [formatSummary(format)]
  if (format.note) bits.push(format.note)
  if (!format.hasAudio && format.hasVideo) bits.push('无音频')
  return bits.join(' · ')
}
</script>

<style scoped>
.format-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.format-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 66px;
  padding: 12px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  background: #fff;
  color: var(--vb-text);
  cursor: pointer;
  transition: border-color var(--vb-transition), box-shadow var(--vb-transition), background var(--vb-transition);
}

.format-card:hover {
  border-color: #c7d2fe;
  background: #fbfbff;
}

.format-card.active {
  border-color: var(--vb-accent);
  background: var(--vb-accent-bg);
  box-shadow: 0 0 0 3px var(--vb-accent-bg);
}

.format-name {
  font-size: 14px;
  font-weight: 700;
}

.format-meta {
  font-size: 12px;
  color: var(--vb-text-secondary);
}

.advanced-panel {
  padding-top: 2px;
}

.advanced-select {
  width: 100%;
}

.advanced-toggle {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--vb-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 520px) {
  .format-grid {
    grid-template-columns: 1fr;
  }
}
</style>
