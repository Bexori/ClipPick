<template>
  <section class="subtitle-panel">
    <div class="subtitle-header">
      <div class="subtitle-copy">
        <h4>{{ panelTitle }}</h4>
        <p>{{ panelHint }}</p>
      </div>
      <div class="subtitle-switch">
        <span>{{ enabled ? '已启用' : '未启用' }}</span>
        <el-switch v-model="enabledProxy" />
      </div>
    </div>

    <div class="subtitle-summary">
      <span v-if="manualCount > 0" class="summary-item">手动字幕 {{ manualCount }}</span>
      <span v-if="autoCount > 0" class="summary-item accent">自动字幕 {{ autoCount }}</span>
      <span v-if="selectedLangs.length > 0" class="summary-item">已选 {{ selectedLangs.length }} 种语言</span>
    </div>

    <div v-if="enabled" class="subtitle-body">
      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-title">字幕类型</div>
          <div class="setting-desc">{{ modeDescription }}</div>
        </div>
        <div class="setting-control">
          <el-segmented v-model="subtitleMode" :options="modeOptions" size="small" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-title">字幕语言</div>
          <div class="setting-desc">不选语言时，将下载当前类型下的全部可用字幕。</div>
        </div>
        <div class="setting-control setting-control-wide">
          <el-select
            v-model="selectedLangsProxy"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全部语言"
            size="small"
            class="subtitle-lang-select"
          >
            <el-option
              v-for="option in languageOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
      </div>

      <div v-if="canEmbedCurrentMode" class="setting-row">
        <div class="setting-copy">
          <div class="setting-title">封装为内嵌字幕轨</div>
          <div class="setting-desc">开启后会在下载完成后尝试把字幕封装进视频容器。播放时需要在播放器的字幕菜单里切换字幕轨。</div>
        </div>
        <div class="setting-control">
          <el-switch :model-value="embedSubs" @update:model-value="emitEmbed" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { SubtitleInfo } from '../../../shared/types'

type SubtitleMode = 'manual' | 'auto' | 'both'

const props = defineProps<{
  subtitles: SubtitleInfo[]
  enabled: boolean
  writeSubs: boolean
  writeAutoSubs: boolean
  embedSubs: boolean
  selectedLangs: string[]
  title?: string
  hint?: string
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:writeSubs': [value: boolean]
  'update:writeAutoSubs': [value: boolean]
  'update:embedSubs': [value: boolean]
  'update:selectedLangs': [value: string[]]
}>()

const panelTitle = computed(() => props.title || '下载字幕')
const manualSubtitles = computed(() => props.subtitles.filter(item => item.kind === 'manual'))
const autoSubtitles = computed(() => props.subtitles.filter(item => item.kind === 'auto'))
const manualCount = computed(() => manualSubtitles.value.length)
const autoCount = computed(() => autoSubtitles.value.length)

const availableModes = computed<SubtitleMode[]>(() => {
  const modes: SubtitleMode[] = []
  if (manualCount.value > 0) modes.push('manual')
  if (autoCount.value > 0) modes.push('auto')
  if (manualCount.value > 0 && autoCount.value > 0) modes.push('both')
  return modes
})

const modeOptions = computed(() => {
  const labels: Record<SubtitleMode, string> = {
    manual: '手动字幕',
    auto: '自动字幕',
    both: '全部字幕'
  }
  return availableModes.value.map(mode => ({ label: labels[mode], value: mode }))
})

const panelHint = computed(() => {
  if (props.hint) return props.hint
  if (manualCount.value > 0 && autoCount.value > 0) {
    return '支持手动字幕和自动字幕，可按类型和语言选择下载。'
  }
  if (autoCount.value > 0) {
    return '当前仅检测到自动字幕，适合没有人工字幕的视频。'
  }
  return '可按语言选择下载字幕，并在支持时封装为内嵌字幕轨。'
})

const enabledProxy = computed({
  get: () => props.enabled,
  set: (value: boolean) => emit('update:enabled', value)
})

const selectedLangsProxy = computed({
  get: () => props.selectedLangs,
  set: (value: string[]) => emit('update:selectedLangs', value)
})

const subtitleMode = computed<SubtitleMode>({
  get() {
    if (props.writeSubs && props.writeAutoSubs) return 'both'
    if (props.writeAutoSubs) return 'auto'
    return 'manual'
  },
  set(value) {
    if (value === 'both') {
      emit('update:writeSubs', true)
      emit('update:writeAutoSubs', true)
      return
    }
    if (value === 'auto') {
      emit('update:writeSubs', false)
      emit('update:writeAutoSubs', true)
      return
    }
    emit('update:writeSubs', true)
    emit('update:writeAutoSubs', false)
  }
})

const activeSubtitles = computed(() => {
  if (subtitleMode.value === 'both') return props.subtitles
  return props.subtitles.filter(item => item.kind === subtitleMode.value)
})

const languageOptions = computed(() => {
  const map = new Map<string, string[]>()

  for (const subtitle of activeSubtitles.value) {
    const kinds = map.get(subtitle.lang) ?? []
    if (!kinds.includes(subtitle.kind)) kinds.push(subtitle.kind)
    map.set(subtitle.lang, kinds)
  }

  return Array.from(map.entries()).map(([lang, kinds]) => ({
    value: lang,
    label: formatLanguageLabel(lang, activeSubtitles.value, kinds)
  }))
})

const canEmbedCurrentMode = computed(() => activeSubtitles.value.some(item => item.embeddable))

const modeDescription = computed(() => {
  if (subtitleMode.value === 'auto') {
    return '将下载平台自动生成的字幕，适合没有人工字幕的视频。'
  }
  if (subtitleMode.value === 'both') {
    return '将同时下载手动字幕和自动字幕。'
  }
  return '优先下载视频自带的手动字幕。'
})

watch(
  availableModes,
  modes => {
    if (modes.length === 0) return
    if (modes.includes(subtitleMode.value)) return
    subtitleMode.value = modes[0]
  },
  { immediate: true }
)

watch(
  languageOptions,
  options => {
    const allowed = new Set(options.map(option => option.value))
    const next = props.selectedLangs.filter(lang => allowed.has(lang))
    if (next.length !== props.selectedLangs.length) {
      emit('update:selectedLangs', next)
    }
  },
  { immediate: true }
)

watch(
  canEmbedCurrentMode,
  value => {
    if (!value && props.embedSubs) {
      emit('update:embedSubs', false)
    }
  },
  { immediate: true }
)

function emitEmbed(value: boolean) {
  emit('update:embedSubs', Boolean(value))
}

function formatLanguageLabel(lang: string, subtitles: SubtitleInfo[], kinds: Array<'manual' | 'auto'>): string {
  const subtitle = subtitles.find(item => item.lang === lang)
  const base = subtitle?.label || lang
  if (kinds.length === 2) return `${base}（手动 + 自动）`
  if (kinds[0] === 'auto') return `${base}（自动字幕）`
  return base
}
</script>

<style scoped>
.subtitle-panel {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--vb-border);
}

.subtitle-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.subtitle-copy {
  min-width: 0;
  flex: 1;
}

.subtitle-copy h4 {
  font-size: 14px;
  font-weight: 700;
  color: var(--vb-text);
}

.subtitle-copy p {
  margin-top: 4px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.subtitle-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--vb-text-secondary);
}

.subtitle-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.summary-item {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--vb-bg-hover);
  color: var(--vb-text-secondary);
  font-size: 11px;
}

.summary-item.accent {
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
}

.subtitle-body {
  margin-top: 14px;
  border-top: 1px solid var(--vb-border-light);
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--vb-border-light);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vb-text);
}

.setting-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--vb-text-tertiary);
  line-height: 1.5;
}

.setting-control {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
}

.setting-control-wide {
  width: 100%;
}

.subtitle-lang-select {
  width: 100%;
}

@media (max-width: 720px) {
  .subtitle-header {
    flex-direction: column;
  }

  .setting-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .setting-control {
    justify-content: flex-start;
  }
}
</style>
