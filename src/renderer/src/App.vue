<template>
  <div class="app-shell">
    <!-- 顶部标题栏 -->
    <header class="title-bar">
      <div class="brand">
        <div class="logo">
          <span class="logo-triangle"></span>
        </div>
        <div class="brand-text">
          <div class="app-name">VideoBox</div>
          <div class="version">v1.0.0</div>
        </div>
      </div>

      <div class="window-actions">
        <button class="icon-btn" title="暗色模式">☾</button>
        <button class="theme-dot"></button>
        <button class="icon-btn" title="设置">⚙</button>
        <span class="split-line"></span>
        <button class="window-btn" @click="winMinimize">—</button>
        <button class="window-btn" @click="winMaximize">□</button>
        <button class="window-btn close" @click="winClose">×</button>
      </div>
    </header>

    <div class="main-layout">
      <!-- 左侧导航 -->
      <aside class="side-nav">
        <router-link
          v-for="item in navs"
          :key="item.key"
          :to="item.route"
          class="nav-item"
          :class="{ active: $route.path === item.route }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.badge && item.badge > 0" class="nav-badge">{{ item.badge }}</span>
        </router-link>
      </aside>

      <!-- 主工作区 -->
      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- 底部状态栏 -->
    <footer class="status-bar">
      <div class="status-item">
        <span class="green-dot"></span>
        yt-dlp 可用
      </div>
      <div class="status-separator"></div>
      <div class="status-item">
        <span class="green-dot"></span>
        ffmpeg 可用
      </div>
      <div class="status-separator"></div>
      <div class="status-item">
        当前 {{ taskCount }} 个下载任务
      </div>
      <div class="status-separator"></div>
      <div class="status-item" :title="savePath">
        保存到 {{ savePath || '未设置' }}
      </div>
      <div class="status-spacer"></div>
      <div class="status-icons">
        <span>♡</span>
        <span class="sakura-icon">✿</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDownloadStore } from './stores/download.store'
import { useSettingsStore } from './stores/settings.store'

const downloadStore = useDownloadStore()
const settingsStore = useSettingsStore()

const taskCount = computed(() => downloadStore.activeTasks.length)

const savePath = computed(() => settingsStore.defaultSavePath)

const navs = computed(() => [
  { key: 'download', label: '视频下载', icon: '⇩', route: '/', badge: 0 },
  { key: 'tasks', label: '下载任务', icon: '▤', route: '/tasks', badge: taskCount.value },
  { key: 'history', label: '下载记录', icon: '◷', route: '/history', badge: 0 },
  { key: 'settings', label: '设置中心', icon: '⚙', route: '/settings', badge: 0 }
])

function winMinimize() {
  // Electron window control - to be wired
}

function winMaximize() {
  // Electron window control - to be wired
}

function winClose() {
  // Electron window control - to be wired
}
</script>

<style scoped>
.app-shell {
  width: 100vw;
  height: 100vh;
  min-width: 900px;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(80, 53, 151, 0.22), transparent 36%),
    radial-gradient(circle at left bottom, rgba(232, 93, 158, 0.12), transparent 32%),
    linear-gradient(135deg, #071226 0%, #0b1326 45%, #080d1c 100%);
  border: 1px solid rgba(122, 150, 196, 0.22);
}

/* ========== 顶部栏 ========== */
.title-bar {
  height: 52px;
  flex-shrink: 0;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, rgba(13, 25, 50, 0.98), rgba(10, 18, 36, 0.98));
  border-bottom: 1px solid rgba(90, 116, 160, 0.22);
  -webkit-app-region: drag;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff4f9a, #815cff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 18px rgba(232, 93, 158, 0.35);
}

.logo-triangle {
  width: 0;
  height: 0;
  margin-left: 3px;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 12px solid white;
}

.brand-text {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-name {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: #f8fafc;
}

.version {
  padding: 3px 9px;
  border-radius: 12px;
  color: #cbd5e1;
  font-size: 12px;
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.icon-btn,
.window-btn {
  width: 30px;
  height: 30px;
  color: #cbd5e1;
  background: transparent;
  border-radius: 8px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover,
.window-btn:hover {
  background: rgba(148, 163, 184, 0.12);
}

.close:hover {
  background: rgba(239, 68, 68, 0.22);
  color: #fecaca;
}

.theme-dot {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #ff5fa7;
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.72),
    0 0 16px rgba(255, 95, 167, 0.45);
}

.split-line {
  width: 1px;
  height: 22px;
  background: rgba(148, 163, 184, 0.22);
}

/* ========== 主布局 ========== */
.main-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ========== 侧栏 ========== */
.side-nav {
  width: 210px;
  flex-shrink: 0;
  padding: 22px 12px;
  background: linear-gradient(180deg, rgba(7, 15, 32, 0.95), rgba(5, 12, 27, 0.95));
  border-right: 1px solid rgba(90, 116, 160, 0.22);
}

.nav-item {
  position: relative;
  height: 48px;
  padding: 0 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  color: #cbd5e1;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.18s, color 0.18s;
  cursor: pointer;
}

.nav-item:hover {
  background: rgba(129, 92, 255, 0.12);
  color: #ffffff;
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(129, 92, 255, 0.28), rgba(232, 93, 158, 0.16));
  color: #ff6fad;
  box-shadow: inset 3px 0 0 #ff5fa7;
}

.nav-icon {
  width: 20px;
  text-align: center;
  font-size: 18px;
}

.nav-badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 95, 167, 0.22);
  color: #ff93c4;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========== 内容区 ========== */
.content {
  flex: 1;
  min-width: 0;
  padding: 18px;
  overflow: auto;
}

/* ========== 状态栏 ========== */
.status-bar {
  height: 34px;
  flex-shrink: 0;
  padding: 0 22px;
  display: flex;
  align-items: center;
  color: #cbd5e1;
  background: rgba(7, 15, 32, 0.96);
  border-top: 1px solid rgba(90, 116, 160, 0.22);
  font-size: 13px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.green-dot {
  width: 10px;
  height: 10px;
  border-radius: 99px;
  background: #22c55e;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.55);
  flex-shrink: 0;
}

.status-separator {
  width: 1px;
  height: 18px;
  margin: 0 18px;
  background: rgba(148, 163, 184, 0.28);
}

.status-spacer {
  flex: 1;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #d8b4fe;
  font-size: 18px;
}

.sakura-icon {
  color: #ff6fad;
}
</style>
