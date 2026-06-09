<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="logo">
        <el-icon :size="24"><VideoCameraFilled /></el-icon>
        <span class="logo-text">VideoBox</span>
      </div>
      <el-menu
        mode="horizontal"
        :default-active="activeMenu"
        :router="true"
        class="nav-menu"
      >
        <el-menu-item index="/">
          <el-icon><Download /></el-icon>
          <span>下载</span>
        </el-menu-item>
        <el-menu-item index="/history">
          <el-icon><Clock /></el-icon>
          <span>历史记录</span>
        </el-menu-item>
      </el-menu>
      <span class="version">v{{ version }}</span>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  VideoCameraFilled, Download, Clock
} from '@element-plus/icons-vue'

const route = useRoute()
const version = ref('1.0.0')

const activeMenu = computed(() => route.path)

onMounted(async () => {
  try {
    version.value = await window.api.getAppVersion()
  } catch { /* use default */ }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #303133;
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  height: 56px;
  -webkit-app-region: drag;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  margin-right: 40px;
  -webkit-app-region: no-drag;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.nav-menu {
  flex: 1;
  border-bottom: none;
  -webkit-app-region: no-drag;
}

.version {
  font-size: 12px;
  color: #c0c4cc;
  user-select: none;
}

.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
