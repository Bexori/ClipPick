<template>
  <div class="settings-page">
    <header class="page-header">
      <div>
        <h2>设置</h2>
        <p>调整下载行为、网络连接和站点登录方式。</p>
      </div>
      <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
    </header>

    <div class="settings-layout">
      <aside class="settings-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </aside>

      <main class="settings-panel">
        <section v-if="activeTab === 'download'" class="panel-section">
          <div class="panel-title">
            <h3>下载</h3>
            <p>保存位置、并发数量和失败重试策略。</p>
          </div>

          <SettingRow title="默认保存目录" desc="新任务会默认保存到这里。">
            <div class="path-setting">
              <span>{{ displaySavePath }}</span>
              <el-button size="small" @click="selectPath">{{ draft.defaultSavePath ? '更改' : '设置' }}</el-button>
            </div>
          </SettingRow>

          <SettingRow title="同时下载数量" desc="建议保持 2-3，过高可能导致站点限流。">
            <el-input-number v-model="draft.concurrentDownloads" :min="1" :max="8" />
          </SettingRow>

          <SettingRow title="自动重试" desc="下载失败后自动重新加入队列。">
            <el-input-number v-model="draft.autoRetryCount" :min="0" :max="3" />
          </SettingRow>
        </section>

        <section v-if="activeTab === 'cookie'" class="panel-section">
          <div class="panel-title">
            <h3>Cookie</h3>
            <p>登录态会影响 Bilibili、TikTok、抖音等站点的解析成功率。</p>
          </div>

          <div class="notice-card">
            <strong>建议优先使用 cookies.txt</strong>
            <span>直接读取 Chrome Cookie 在 Windows 上容易失败；只有确实需要登录视频时再启用。</span>
          </div>

          <SettingRow title="Cookie 来源" desc="自动模式不会强制读取浏览器 Cookie。">
            <el-segmented v-model="draft.cookieMode" :options="cookieModeOptions" />
          </SettingRow>

          <SettingRow v-if="draft.cookieMode === 'browser'" title="浏览器" desc="Chrome 暂时不建议使用，可能出现数据库复制失败。">
            <el-select v-model="draft.cookieBrowser" class="setting-control">
              <el-option label="Microsoft Edge" value="edge" />
              <el-option label="Google Chrome" value="chrome" />
              <el-option label="Brave" value="brave" />
              <el-option label="Vivaldi" value="vivaldi" />
            </el-select>
          </SettingRow>

          <SettingRow v-if="draft.cookieMode === 'file'" title="cookies.txt" desc="填写 Netscape 格式 cookies.txt 的完整路径。">
            <el-input v-model="draft.cookiesFile" placeholder="例如 D:\\cookies.txt" />
          </SettingRow>
        </section>

        <section v-if="activeTab === 'network'" class="panel-section">
          <div class="panel-title">
            <h3>网络</h3>
            <p>代理会同时用于解析和下载。</p>
          </div>

          <SettingRow title="代理地址" desc="支持 HTTP、HTTPS、SOCKS5；留空则直连。">
            <el-input v-model="draft.proxy" placeholder="例如 http://127.0.0.1:7890" />
          </SettingRow>

          <div class="example-list">
            <span>常见示例</span>
            <code>http://127.0.0.1:7890</code>
            <code>socks5://127.0.0.1:7891</code>
          </div>
        </section>

        <section v-if="activeTab === 'notify'" class="panel-section">
          <div class="panel-title">
            <h3>通知</h3>
            <p>控制下载完成后的反馈方式。</p>
          </div>

          <SettingRow title="下载完成通知" desc="任务完成后显示应用内通知。">
            <el-switch v-model="draft.downloadNotifications" />
          </SettingRow>
        </section>
      </main>
    </div>

    <div class="footer-actions">
      <el-button @click="resetDraft">放弃修改</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell, Connection, Download, Key } from '@element-plus/icons-vue'
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settings.store'
import type { AppSettings } from '../../../shared/types'
import SettingRow from '../components/SettingRow.vue'

type TabKey = 'download' | 'cookie' | 'network' | 'notify'

const settingsStore = useSettingsStore()
const saving = ref(false)
const activeTab = ref<TabKey>('download')

const navItems = [
  { key: 'download', label: '下载', icon: Download },
  { key: 'cookie', label: 'Cookie', icon: Key },
  { key: 'network', label: '网络', icon: Connection },
  { key: 'notify', label: '通知', icon: Bell }
] as const

const cookieModeOptions = [
  { label: '自动', value: 'auto' },
  { label: '浏览器', value: 'browser' },
  { label: '文件', value: 'file' },
  { label: '关闭', value: 'none' }
]

const draft = reactive<AppSettings>({ ...settingsStore.settings })

const displaySavePath = computed(() => {
  if (draft.defaultSavePath) return draft.defaultSavePath
  if (settingsStore.defaultSavePath) return settingsStore.defaultSavePath
  return '项目默认目录（downloads/）'
})

onMounted(async () => {
  if (!settingsStore.loaded) await settingsStore.loadFromLocal()
  resetDraft()
})

function resetDraft() {
  Object.assign(draft, settingsStore.settings)
}

async function selectPath() {
  const path = await window.api.selectSavePath()
  if (path) draft.defaultSavePath = path
}

async function save() {
  saving.value = true
  try {
    await settingsStore.saveSettings({ ...draft })
    resetDraft()
    ElMessage.success('设置已保存')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 32px 28px 48px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--vb-text);
}

.page-header p {
  margin-top: 6px;
  color: var(--vb-text-secondary);
}

.settings-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 18px;
}

.settings-nav {
  align-self: start;
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  background: var(--vb-bg-surface);
}

.settings-nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--vb-radius-sm);
  background: transparent;
  color: var(--vb-text-secondary);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.settings-nav button:hover {
  background: var(--vb-bg-hover);
  color: var(--vb-text);
}

.settings-nav button.active {
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
}

.settings-panel {
  min-width: 0;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  background: var(--vb-bg-surface);
}

.panel-section {
  padding: 24px;
}

.panel-title {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--vb-border-light);
}

.panel-title h3 {
  font-size: 18px;
  color: var(--vb-text);
}

.panel-title p {
  margin-top: 4px;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.path-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.path-setting span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vb-text-secondary);
}

.setting-control {
  width: 220px;
}

.notice-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 18px 0 4px;
  padding: 12px 14px;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: var(--vb-radius-sm);
  background: var(--vb-warning-bg);
}

.notice-card strong {
  color: #92400e;
  font-size: 13px;
}

.notice-card span {
  color: #a16207;
  font-size: 12px;
}

.example-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.example-list code {
  padding: 4px 7px;
  border-radius: var(--vb-radius-xs);
  background: var(--vb-bg-hover);
  color: var(--vb-text-secondary);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
  }

  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }

  .settings-nav button {
    flex-shrink: 0;
  }
}
</style>
