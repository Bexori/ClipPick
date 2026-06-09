<template>
  <div class="settings-page">
    <h2>设置中心</h2>

    <div class="settings-card">
      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-title">默认保存路径</div>
          <div class="setting-desc">下载的视频文件将默认保存到此目录。</div>
        </div>
        <div class="setting-control path-control">
          <el-input
            :model-value="store.defaultSavePath"
            placeholder="选择保存目录"
            readonly
            size="large"
          >
            <template #append>
              <el-button @click="handleSelectPath">选择目录</el-button>
            </template>
          </el-input>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-title">最大并发下载数</div>
          <div class="setting-desc">同时下载的任务数量上限（1-5）。</div>
        </div>
        <div class="setting-control">
          <el-input-number
            v-model="store.concurrentDownloads"
            :min="1"
            :max="5"
            size="large"
          />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-title">引擎状态</div>
          <div class="setting-desc">下载和转码依赖的外部工具。</div>
        </div>
        <div class="setting-control engine-status">
          <div class="engine-item">
            <span class="green-dot"></span>
            <span>yt-dlp</span>
            <span class="engine-ver">可用</span>
          </div>
          <div class="engine-item">
            <span class="green-dot"></span>
            <span>ffmpeg</span>
            <span class="engine-ver">可用</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settings.store'

const store = useSettingsStore()

async function handleSelectPath() {
  const result = await window.api.selectSavePath()
  if (result) {
    store.defaultSavePath = result
  }
}
</script>

<style scoped>
.settings-page {
  max-width: 700px;
}

.settings-page h2 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 800;
  color: #f8fafc;
}

.settings-card {
  border-radius: 14px;
  padding: 4px;
  background: linear-gradient(180deg, rgba(17, 31, 59, 0.92), rgba(12, 23, 44, 0.92));
  border: 1px solid rgba(96, 125, 172, 0.26);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  gap: 24px;
}

.setting-item + .setting-item {
  border-top: 1px solid rgba(96, 125, 172, 0.18);
}

.setting-title {
  color: #f8fafc;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
}

.setting-desc {
  color: #94a3b8;
  font-size: 12px;
}

.setting-control {
  flex-shrink: 0;
  min-width: 240px;
}

.path-control {
  width: 380px;
}

.engine-status {
  display: flex;
  gap: 24px;
}

.engine-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 14px;
}

.green-dot {
  width: 10px;
  height: 10px;
  border-radius: 99px;
  background: #22c55e;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.55);
}

.engine-ver {
  color: #86efac;
  font-size: 12px;
}
</style>
