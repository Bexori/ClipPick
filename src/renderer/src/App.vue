<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
      <aside class="sidebar">
        <nav class="sidebar-nav">
          <router-link to="/" class="nav-item" :class="{ active: activeMenu === '/' }" title="首页">
            <el-icon :size="18"><Download /></el-icon>
            <span>首页</span>
          </router-link>
          <router-link to="/history" class="nav-item" :class="{ active: activeMenu === '/history' }" title="历史">
            <el-icon :size="18"><Clock /></el-icon>
            <span>历史</span>
          </router-link>
          <router-link to="/saved-urls" class="nav-item" :class="{ active: activeMenu === '/saved-urls' }" title="收藏">
            <el-icon :size="18"><Star /></el-icon>
            <span>收藏</span>
          </router-link>
          <router-link to="/audio-extract" class="nav-item" :class="{ active: activeMenu === '/audio-extract' }" title="提取音频">
            <el-icon :size="18"><Headset /></el-icon>
            <span>提取音频</span>
          </router-link>
        </nav>

        <div class="sidebar-footer">
          <button type="button" class="settings-btn" :class="{ active: activeMenu === '/settings' }" title="设置" @click="openSettings">
            <el-icon :size="18"><Setting /></el-icon>
            <span>设置</span>
          </button>
        </div>

        <div class="hover-zone">
          <button type="button" class="sidebar-toggle" @click="toggleCollapsed">
            <el-icon :size="12"><ArrowRightBold v-if="collapsed" /><ArrowLeftBold v-else /></el-icon>
          </button>
        </div>
      </aside>

      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <el-dialog
      v-model="releaseDialogVisible"
      title="版本更新"
      width="520px"
      destroy-on-close
      class="release-dialog"
    >
      <div class="release-dialog__meta">当前版本 {{ currentVersion }}</div>
      <div class="release-dialog__body">
        <div v-for="section in releaseSections" :key="section.title" class="release-section">
          <h4>{{ section.title }}</h4>
          <ul>
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeReleaseDialog">我知道了</el-button>
      </template>
    </el-dialog>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftBold, ArrowRightBold, Clock, Download, Headset, Setting, Star } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import ja from 'element-plus/es/locale/lang/ja'
import { useSettingsStore } from './stores/settings.store'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const collapsed = ref(localStorage.getItem('clippick-sidebar-collapsed') === '1')
const activeMenu = computed(() => route.path)
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
const releaseDialogVisible = ref(false)
const currentVersion = ref('')
const releaseSections = ref<Array<{ title: string; items: string[] }>>([])

const accentPresets: Record<string, string> = {
  indigo: '#6c5ce7',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  rose: '#f43f5e'
}

const releaseNotesMap: Record<string, Array<{ title: string; items: string[] }>> = {
  '1.2.1': [
    {
      title: '本次重点修复',
      items: [
        'B站扫码登录与翻译请求改为按设置中的代理单独发起。',
        '没有配置代理时保持直连，不会强制依赖代理。',
        '二维码登录和翻译失败时，错误提示更明确，不再直接暴露底层报错。'
      ]
    },
    {
      title: '体验优化',
      items: [
        '字幕下载结果提示更清晰，区分外挂字幕、字幕轨封装成功和封装失败。',
        '部分设置与登录交互文案做了整理，降低误导性提示。',
        '升级后首次打开会展示更新内容，且只会在真实升级后的首次启动出现。'
      ]
    }
  ]
}

const elementLocale = computed(() => {
  const lang = resolveLanguage(settingsStore.appLanguage)
  if (lang === 'en') return en
  if (lang === 'ja') return ja
  return zhCn
})

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  localStorage.setItem('clippick-sidebar-collapsed', collapsed.value ? '1' : '0')
}

function openSettings() {
  router.push('/settings')
}

function resolveTheme(mode: string) {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return colorScheme.matches ? 'dark' : 'light'
}

function resolveLanguage(mode: string) {
  if (mode === 'en' || mode === 'ja' || mode === 'zh-CN') return mode
  const browser = navigator.language.toLowerCase()
  if (browser.startsWith('en')) return 'en'
  if (browser.startsWith('ja')) return 'ja'
  return 'zh-CN'
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const hex = match[1]
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  }
}

function toHexChannel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`
}

function mixHexColor(from: string, to: string, amount: number): string {
  const start = parseHexColor(from)
  const end = parseHexColor(to)
  if (!start || !end) return from
  const ratio = Math.min(1, Math.max(0, amount))
  return rgbToHex(
    start.r + (end.r - start.r) * ratio,
    start.g + (end.g - start.g) * ratio,
    start.b + (end.b - start.b) * ratio
  )
}

function accentToThemeVars(accent: string) {
  const preset = accentPresets[accent]
  if (preset) {
    const base = parseHexColor(preset)
    return {
      token: accent,
      accent: preset,
      accentLight: mixHexColor(preset, '#ffffff', 0.15),
      accentBg: `rgba(${base?.r ?? 108}, ${base?.g ?? 92}, ${base?.b ?? 231}, 0.08)`
    }
  }

  const normalized = parseHexColor(accent) ? accent : accentPresets.indigo
  const base = parseHexColor(normalized) || parseHexColor(accentPresets.indigo)!
  return {
    token: 'custom',
    accent: normalized,
    accentLight: mixHexColor(normalized, '#ffffff', 0.15),
    accentBg: `rgba(${base.r}, ${base.g}, ${base.b}, 0.08)`
  }
}

function applyUiSettings() {
  const root = document.documentElement
  const settings = settingsStore.settings

  root.dataset.vbTheme = resolveTheme(settings.themeMode)
  const accent = accentToThemeVars(settings.accentColor)
  root.dataset.vbAccent = accent.token
  root.style.setProperty('--vb-accent', accent.accent)
  root.style.setProperty('--vb-accent-light', accent.accentLight)
  root.style.setProperty('--vb-accent-bg', accent.accentBg)
  root.dataset.vbDensity = settings.density
  root.lang = resolveLanguage(settings.appLanguage)
}

function handleColorSchemeChange() {
  if (settingsStore.settings.themeMode === 'system') {
    applyUiSettings()
  }
}

async function maybeShowReleaseNotes() {
  try {
    const version = await window.api.getAppVersion()
    currentVersion.value = version

    if (!version) return

    const lastRunVersion = localStorage.getItem('clippick-last-run-version') || ''
    const seenVersion = localStorage.getItem('clippick-last-seen-version') || ''

    localStorage.setItem('clippick-last-run-version', version)

    const upgradedFromPreviousVersion = Boolean(lastRunVersion) && lastRunVersion !== version
    if (!upgradedFromPreviousVersion || seenVersion === version) return

    releaseSections.value = releaseNotesMap[version] || [
      {
        title: '版本已更新',
        items: ['当前版本已更新到最新安装包，本次更新包含稳定性修复与体验优化。']
      }
    ]

    releaseDialogShouldPersist.value = true
    window.setTimeout(() => {
      releaseDialogVisible.value = true
    }, 480)
  } catch {
    currentVersion.value = ''
  }
}

function persistReleaseDialogSeen() {
  if (!releaseDialogShouldPersist.value || !currentVersion.value) return
  localStorage.setItem('clippick-last-seen-version', currentVersion.value)
  releaseDialogShouldPersist.value = false
}

function closeReleaseDialog() {
  persistReleaseDialogSeen()
  releaseDialogVisible.value = false
}

function handleReleaseDialogClosed() {
  persistReleaseDialogSeen()
}

onMounted(async () => {
  if (!settingsStore.loaded) {
    await settingsStore.loadFromLocal()
  }

  applyUiSettings()
  colorScheme.addEventListener?.('change', handleColorSchemeChange)
  await maybeShowReleaseNotes()
})

watch(
  () => [
    settingsStore.themeMode,
    settingsStore.accentColor,
    settingsStore.density,
    settingsStore.appLanguage,
    settingsStore.loaded
  ],
  () => {
    applyUiSettings()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  colorScheme.removeEventListener?.('change', handleColorSchemeChange)
})
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  min-width: 0;
  background: var(--vb-bg);
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--vb-bg-surface);
  border-right: 1px solid var(--vb-border);
  -webkit-app-region: drag;
  user-select: none;
  transition: width var(--vb-transition);
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 10px 0;
  -webkit-app-region: no-drag;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 10px 12px;
  border-radius: var(--vb-radius-sm);
  color: var(--vb-text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all var(--vb-transition);
}

.nav-item span {
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  color: var(--vb-text);
  background: var(--vb-bg-hover);
}

.nav-item.active {
  color: var(--vb-accent-light);
  background: var(--vb-accent-bg);
}

.sidebar-footer {
  padding: 12px 10px;
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--vb-radius-sm);
  background: transparent;
  color: var(--vb-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--vb-transition);
  text-align: left;
}

.settings-btn:hover,
.settings-btn.active {
  color: var(--vb-text);
  background: var(--vb-bg-hover);
}

.settings-btn span {
  white-space: nowrap;
  overflow: hidden;
}

.hover-zone {
  position: absolute;
  right: 0;
  top: 30%;
  transform: translateX(50%);
  width: 16px;
  height: 52px;
  z-index: 10;
  -webkit-app-region: no-drag;
}

.sidebar-toggle {
  width: 100%;
  height: 100%;
  border: 1px solid var(--vb-border);
  border-radius: 10px;
  background: var(--vb-bg-surface);
  color: var(--vb-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.sidebar:hover .sidebar-toggle {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-toggle:active {
  opacity: 0;
}

.sidebar-collapsed .sidebar {
  width: 64px;
}

.sidebar-collapsed .nav-item span,
.sidebar-collapsed .settings-btn span {
  display: none;
}

.sidebar-collapsed .sidebar-nav {
  padding: 12px 10px 0;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

.sidebar-collapsed .sidebar-footer {
  padding: 12px 10px;
  display: flex;
  align-items: center;
}

.sidebar-collapsed .settings-btn {
  justify-content: center;
  padding: 10px;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 150ms ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

.release-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.release-dialog__meta {
  margin-bottom: 12px;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.release-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.release-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--vb-text);
}

.release-section ul {
  margin: 0;
  padding-left: 18px;
  color: var(--vb-text-secondary);
  line-height: 1.7;
}

@media (max-width: 900px) {
  .sidebar {
    width: 72px;
  }

  .sidebar-nav {
    padding: 12px 10px 0;
  }

  .nav-item,
  .settings-btn {
    justify-content: center;
    padding: 10px;
  }

  .nav-item span,
  .settings-btn span,
  .hover-zone {
    display: none;
  }

  .sidebar-footer {
    align-items: center;
  }
}
</style>



