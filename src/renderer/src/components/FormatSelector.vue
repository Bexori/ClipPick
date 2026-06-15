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

    <div v-if="extraOptions.length > 0" class="advanced-wrap">
      <button type="button" class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span>{{ showAdvanced ? '收起更多格式' : `展开更多格式 (${extraOptions.length})` }}</span>
        <el-icon :size="14">
          <ArrowDown v-if="!showAdvanced" />
          <ArrowUp v-else />
        </el-icon>
      </button>

      <el-collapse-transition>
        <div v-show="showAdvanced" class="advanced-panel">
          <div class="advanced-grid">
            <button
              v-for="format in extraOptions"
              :key="format.formatId"
              type="button"
              class="advanced-card"
              :class="{ active: modelValue === format.formatId }"
              @click="select(format.formatId)"
            >
              <span class="advanced-title">{{ formatSummary(format) }}</span>
              <span class="advanced-meta">{{ formatLabel(format) }}</span>
            </button>
          </div>
        </div>
      </el-collapse-transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { VideoFormat } from '../../../shared/types'

const props = defineProps<{
  formats: VideoFormat[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showAdvanced = ref(false)

const sortedFormats = computed(() => [...props.formats].sort((a, b) => {
  const aScore = formatScore(a)
  const bScore = formatScore(b)
  return bScore - aScore
}))

const primaryOptions = computed(() => sortedFormats.value.slice(0, 4).map((format) => ({
  name: formatSummary(format),
  value: format.formatId,
  meta: formatLabel(format)
})))

const extraOptions = computed(() => {
  const primaryValues = new Set(primaryOptions.value.map(item => item.value))
  return sortedFormats.value.filter(format => !primaryValues.has(format.formatId))
})

watch(
  () => props.formats.map(format => format.formatId).join('|'),
  () => {
    showAdvanced.value = false
  }
)

function select(value: string) {
  emit('update:modelValue', value)
}

function formatScore(format: VideoFormat): number {
  const qualityScore = format.height > 0 ? format.height * 10_000 : 0
  const audioScore = !format.hasVideo && format.hasAudio ? 50_000 : 0
  const audioPenalty = format.hasVideo && !format.hasAudio ? 5_000 : 0
  const sizeScore = Math.min(format.filesize || 0, 5_000_000_000) / 1000
  return qualityScore + audioScore - audioPenalty + sizeScore
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
  text-align: left;
  line-height: 1.35;
}

.advanced-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  background: var(--vb-bg-surface);
  color: var(--vb-accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 10px 12px;
  transition: border-color var(--vb-transition), background var(--vb-transition), color var(--vb-transition);
}

.advanced-toggle:hover {
  border-color: var(--vb-accent-light);
  background: var(--vb-accent-bg);
}

.advanced-panel {
  padding: 10px 2px 2px;
  border-left: 1px solid var(--vb-border-light);
  margin-left: 10px;
}

.advanced-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.advanced-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 62px;
  padding: 10px 12px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  background: var(--vb-bg-surface);
  color: var(--vb-text);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--vb-transition), background var(--vb-transition), box-shadow var(--vb-transition);
}

.advanced-card:hover {
  border-color: var(--vb-accent-light);
  background: var(--vb-accent-bg);
}

.advanced-card.active {
  border-color: var(--vb-accent);
  background: var(--vb-accent-bg);
  box-shadow: 0 0 0 3px var(--vb-accent-bg);
}

.advanced-title {
  font-size: 13px;
  font-weight: 700;
}

.advanced-meta {
  font-size: 12px;
  color: var(--vb-text-secondary);
  line-height: 1.35;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 520px) {
  .format-grid,
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}
</style>
