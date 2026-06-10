<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <el-icon :size="22"><VideoCameraFilled /></el-icon>
        </div>
        <span class="brand-text">影盒</span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: activeMenu === '/' }" title="下载">
          <el-icon :size="18"><Download /></el-icon>
          <span>下载</span>
        </router-link>
        <router-link to="/history" class="nav-item" :class="{ active: activeMenu === '/history' }" title="历史记录">
          <el-icon :size="18"><Clock /></el-icon>
          <span>历史记录</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="settings-btn" title="设置" @click="openSettings">
          <el-icon :size="18"><Setting /></el-icon>
          <span>设置</span>
        </button>
      </div>

      <div class="hover-zone">
        <button
          type="button"
          class="sidebar-toggle"
          @click="toggleCollapsed"
        >
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

    <SettingsDialog ref="settingsRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftBold, ArrowRightBold, Clock, Download, Setting, VideoCameraFilled } from '@element-plus/icons-vue'
import SettingsDialog from './components/SettingsDialog.vue'

const route = useRoute()
const collapsed = ref(localStorage.getItem('videobox-sidebar-collapsed') === '1')
const settingsRef = ref<InstanceType<typeof SettingsDialog> | null>(null)

const activeMenu = computed(() => route.path)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  localStorage.setItem('videobox-sidebar-collapsed', collapsed.value ? '1' : '0')
}

function openSettings() {
  settingsRef.value?.open()
}
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
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

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 12px 24px 18px;
  -webkit-app-region: no-drag;
}

.brand-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-accent);
  border-radius: var(--vb-radius-sm);
  color: #fff;
  flex-shrink: 0;
}

.brand-text {
  font-size: 17px;
  font-weight: 700;
  color: var(--vb-text);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
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

.settings-btn:hover {
  color: var(--vb-text);
  background: var(--vb-bg-hover);
}

.settings-btn span {
  white-space: nowrap;
  overflow: hidden;
}

/* hover zone on sidebar border - half in, half out */
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

/* collapse toggle - fills hover zone, hidden until hover */
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

.sidebar-collapsed .sidebar-brand {
  padding-left: 14px;
  padding-right: 14px;
  justify-content: center;
}

.sidebar-collapsed .brand-text,
.sidebar-collapsed .nav-item span,
.sidebar-collapsed .settings-btn span {
  display: none;
}

.sidebar-collapsed .sidebar-nav {
  padding: 0 10px;
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
  overflow-y: auto;
  overflow-x: hidden;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 760px) {
  .sidebar {
    width: 64px;
  }

  .brand-text,
  .nav-item span,
  .settings-btn span {
    display: none;
  }

  .sidebar-brand {
    padding-left: 14px;
    padding-right: 14px;
    justify-content: center;
  }

  .sidebar-toggle {
    display: none;
  }

  .sidebar-nav {
    padding: 0 10px;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    padding: 12px 10px;
  }

  .settings-btn {
    justify-content: center;
    padding: 10px;
  }
}
</style>
