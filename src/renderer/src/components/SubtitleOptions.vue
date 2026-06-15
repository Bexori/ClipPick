<template>
  <section class="subtitle-panel">
    <div class="subtitle-head">
      <div class="subtitle-copy">
        <div class="subtitle-title-row">
          <h4>{{ title }}</h4>
          <span class="subtitle-count">{{ subtitles.length }} 轨道</span>
        </div>
        <p>{{ hint }}</p>
        <div class="subtitle-stats">
          <span class="stat-pill">手动 {{ manualCount }}</span>
          <span class="stat-pill">自动 {{ autoCount }}</span>
          <span v-if="selectedLangs.length > 0" class="stat-pill accent">已选 {{ selectedLangs.length }} 语言</span>
        </div>
      </div>

      <el-segmented
        v-model="enabledMode"
        :options="[
          { label: '开启字幕', value: 'on' },
          { label: '关闭字幕', value: 'off' }
        ]"
        size="small"
        class="subtitle-enabled-switch"
      />
    </div>

    <transition name="el-fade-in-linear">
      <div v-if="enabled" class="subtitle-body">
        <div class="subtitle-row">
          <div class="row-label">下载模式</div>
          <el-segmented v-model="subtitleMode" :options="modeOptions" size="small" />
        </div>

        <div class="subtitle-row">
          <div class="row-label">字幕语言</div>
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
              v-for="sub in subtitles"
              :key="`${sub.lang}-${sub.kind}`"
              :label="sub.label"
              :value="sub.lang"
            />
          </el-select>
        </div>

        <div class="subtitle-footer">
          <span class="footer-note">不选语言时会下载全部可用字幕。</span>
          <label class="embed-switch">
            <span>嵌入视频</span>
            <el-switch :model-value="embedSubs" @update:model-value="emitEmbed" />
          </label>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SubtitleInfo } from '../../../shared/types'

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

const modeOptions = [
  { label: '手动', value: 'manual' },
  { label: '自动', value: 'auto' },
  { label: '全部', value: 'both' }
]

const title = computed(() => props.title || '下载字幕')
const hint = computed(() => props.hint || '支持手动字幕、自动字幕，可选择语言并嵌入视频。')

const manualCount = computed(() => props.subtitles.filter(item => item.kind === 'manual').length)
const autoCount = computed(() => props.subtitles.filter(item => item.kind === 'auto').length)

const subtitleMode = computed({
  get() {
    if (props.writeSubs && props.writeAutoSubs) return 'both'
    if (props.writeAutoSubs) return 'auto'
    return 'manual'
  },
  set(value: string) {
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

const enabledMode = computed({
  get() {
    return props.enabled ? 'on' : 'off'
  },
  set(value: string) {
    emit('update:enabled', value === 'on')
  }
})

const selectedLangsProxy = computed({
  get() {
    return props.selectedLangs
  },
  set(value: string[]) {
    emit('update:selectedLangs', value)
  }
})

function emitEnabled(value: boolean) {
  emit('update:enabled', Boolean(value))
}

function emitEmbed(value: boolean) {
  emit('update:embedSubs', Boolean(value))
}
</script>

<style scoped>
.subtitle-panel {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vb-border);
}

.subtitle-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.subtitle-enabled-switch {
  flex-shrink: 0;
}

.subtitle-copy {
  min-width: 0;
  flex: 1;
}

.subtitle-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subtitle-title-row h4 {
  font-size: 14px;
  font-weight: 700;
  color: var(--vb-text);
}

.subtitle-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
  font-size: 11px;
}

.subtitle-copy p {
  margin-top: 4px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.subtitle-stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.stat-pill {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--vb-bg-hover);
  color: var(--vb-text-secondary);
  font-size: 11px;
}

.stat-pill.accent {
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
}

.subtitle-body {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.subtitle-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.row-label {
  font-size: 12px;
  color: var(--vb-text-secondary);
}

.subtitle-lang-select {
  width: 100%;
}

.subtitle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-note {
  font-size: 12px;
  color: var(--vb-text-tertiary);
}

.embed-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vb-text-secondary);
}

@media (max-width: 720px) {
  .subtitle-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .subtitle-head {
    flex-direction: column;
  }

  .subtitle-enabled-switch {
    width: 100%;
  }
}
</style>
