<template>
  <el-dialog v-model="visible" title="设置" width="680px" top="5vh" class="settings-dialog" destroy-on-close>
    <div class="sd-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <el-icon :size="16"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="sd-panel">
      <section v-if="activeTab === 'download'">
        <SettingRow title="默认保存目录" desc="新任务会默认保存到这里。">
          <div class="path-setting">
            <span>{{ displaySavePath }}</span>
            <el-button size="small" @click="selectPath">{{ draft.defaultSavePath ? '更改' : '设置' }}</el-button>
          </div>
        </SettingRow>
        <SettingRow title="同时下载数量" desc="建议保持 2-3，过高可能导致站点限流。">
          <el-input-number v-model="draft.concurrentDownloads" :min="1" :max="8" size="small" />
        </SettingRow>
        <SettingRow title="自动重试" desc="下载失败后自动重新加入队列。">
          <el-input-number v-model="draft.autoRetryCount" :min="0" :max="3" size="small" />
        </SettingRow>
      </section>

      <section v-if="activeTab === 'cookie'">
        <div class="notice-card">
          <strong>建议优先使用 cookies.txt</strong>
          <span>直接读取 Chrome Cookie 在 Windows 上容易失败；只有确实需要登录视频时再启用。</span>
        </div>
        <SettingRow title="Cookie 来源" desc="自动模式不会强制读取浏览器 Cookie。">
          <el-segmented v-model="draft.cookieMode" :options="cookieModeOptions" size="small" />
        </SettingRow>
        <SettingRow v-if="draft.cookieMode === 'browser'" title="浏览器" desc="Chrome 暂时不建议使用，可能出现数据库复制失败。">
          <el-select v-model="draft.cookieBrowser" size="small" style="width: 200px">
            <el-option label="Microsoft Edge" value="edge" />
            <el-option label="Google Chrome" value="chrome" />
            <el-option label="Brave" value="brave" />
            <el-option label="Vivaldi" value="vivaldi" />
          </el-select>
        </SettingRow>
        <SettingRow v-if="draft.cookieMode === 'file'" title="cookies.txt" desc="填写 Netscape 格式 cookies.txt 的完整路径。">
          <el-input v-model="draft.cookiesFile" placeholder="例如 D:\\cookies.txt" size="small" />
        </SettingRow>
      </section>

      <section v-if="activeTab === 'network'">
        <SettingRow title="代理地址" desc="支持 HTTP、HTTPS、SOCKS5；留空则直连。">
          <el-input v-model="draft.proxy" placeholder="例如 http://127.0.0.1:7890" size="small" />
        </SettingRow>
        <div class="example-list">
          <span>常见示例</span>
          <code>http://127.0.0.1:7890</code>
          <code>socks5://127.0.0.1:7891</code>
        </div>
      </section>

      <section v-if="activeTab === 'translate'">
        <div class="notice-card" style="border-color: rgba(59, 130, 246, 0.22); background: var(--vb-info-bg);">
          <strong style="color: #1e40af;">AI 翻译说明</strong>
          <span style="color: #2563eb;">翻译功能调用 DeepSeek API，需自行申请 API Key。费用极低，按用量计费。</span>
        </div>
        <div v-for="(profile, idx) in draft.translateProfiles" :key="profile.id" class="profile-card">
          <div class="profile-header">
            <span class="profile-name">{{ profile.name }}</span>
            <span v-if="profile.hasKey" class="profile-key-status">已配置 Key</span>
            <span v-else class="profile-key-status missing">未配置 Key</span>
          </div>
          <div class="profile-body">
            <div class="profile-field">
              <label>API 地址</label>
              <el-input v-model="profile.endpoint" size="small" placeholder="https://api.deepseek.com/v1" />
            </div>
            <div class="profile-field">
              <label>模型名称</label>
              <el-input v-model="profile.model" size="small" placeholder="deepseek-chat" />
            </div>
            <div class="profile-field">
              <label>API Key</label>
              <el-input
                :model-value="profileKeys[idx] || ''"
                type="password"
                show-password
                size="small"
                placeholder="sk-..."
                @update:model-value="onKeyChange(idx, $event)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'bilibili'">
        <div class="notice-card" style="border-color: rgba(251, 114, 153, 0.22); background: rgba(251, 114, 153, 0.06);">
          <strong style="color: #be185d;">B站登录</strong>
          <span style="color: #db2777;">登录后可下载高清视频及番剧资源。Cookie 会安全保存在本地。</span>
        </div>
        <div class="bili-section">
          <div class="bili-status-row">
            <span>状态：</span>
            <span v-if="biliState.loggedIn && !biliState.expired" class="bili-status success">
              已登录{{ biliState.nickname ? `（${biliState.nickname}）` : '' }}
            </span>
            <span v-else class="bili-status muted">未登录</span>
          </div>
          <div class="bili-actions">
            <el-button type="primary" size="small" @click="biliDialogVisible = true">
              {{ biliState.loggedIn && !biliState.expired ? '重新登录' : '扫码登录' }}
            </el-button>
            <el-button
              v-if="biliState.loggedIn"
              size="small"
              plain
              type="danger"
              @click="handleBiliLogout"
            >
              退出登录
            </el-button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'notify'">
        <SettingRow title="下载完成通知" desc="任务完成后显示桌面通知。">
          <el-switch v-model="draft.downloadNotifications" size="small" />
        </SettingRow>
      </section>
    </div>

    <el-dialog v-model="biliDialogVisible" title="B站登录" width="360px" top="8vh" destroy-on-close>
      <BilibiliLoginDialog @close="biliDialogVisible = false" @logged-in="onBiliLoggedIn" />
    </el-dialog>

    <template #footer>
      <div class="dialog-footer">
        <span class="dialog-version">ClipPick v{{ version }}</span>
        <div class="dialog-actions">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { Bell, ChatLineSquare, Connection, Download, Key, UserFilled } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settings.store'
import type { AppSettings, TranslateProfile } from '../../../shared/types'
import SettingRow from './SettingRow.vue'
import BilibiliLoginDialog from './BilibiliLoginDialog.vue'

type TabKey = 'download' | 'cookie' | 'network' | 'notify' | 'translate' | 'bilibili'

const settingsStore = useSettingsStore()
const visible = ref(false)
const saving = ref(false)
const version = ref('1.0.0')
const activeTab = ref<TabKey>('download')
const biliDialogVisible = ref(false)
const biliState = ref<{ loggedIn: boolean; expired: boolean; nickname?: string }>({ loggedIn: false, expired: false })

const tabs = [
  { key: 'download', label: '下载', icon: Download },
  { key: 'cookie', label: 'Cookie', icon: Key },
  { key: 'network', label: '网络', icon: Connection },
  { key: 'translate', label: '翻译', icon: ChatLineSquare },
  { key: 'bilibili', label: 'B站', icon: UserFilled },
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

const profileKeys = ref<string[]>([])

async function open() {
  if (!settingsStore.loaded) await settingsStore.loadFromLocal()
  Object.assign(draft, settingsStore.settings)
  // Ensure translate profiles default
  if (!draft.translateProfiles || draft.translateProfiles.length === 0) {
    draft.translateProfiles = [
      { id: 'default', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', hasKey: false }
    ]
  }
  profileKeys.value = draft.translateProfiles.map(() => '')
  try { version.value = await window.api.getAppVersion() } catch { /* use default */ }
  try { biliState.value = await window.api.getBiliState() } catch { /* ignore */ }
  visible.value = true
}

function onKeyChange(idx: number, value: string) {
  profileKeys.value[idx] = value
}

function onBiliLoggedIn() {
  try { window.api.getBiliState().then(s => { biliState.value = s }) } catch { /* ignore */ }
}

async function handleBiliLogout() {
  await window.api.clearBiliCookies()
  biliState.value = { loggedIn: false, expired: false }
  ElMessage.success('已退出B站登录')
}

async function selectPath() {
  const p = await window.api.selectSavePath()
  if (p) draft.defaultSavePath = p
}

async function save() {
  saving.value = true
  try {
    // Save API keys for each profile
    for (let i = 0; i < draft.translateProfiles.length; i++) {
      const key = profileKeys.value[i]
      if (key) {
        await window.api.setDeepseekKey(draft.translateProfiles[i].id, key)
      }
    }
    const saveData = { ...draft }
    // Remove hasKey from profiles before saving (it's derived)
    saveData.translateProfiles = draft.translateProfiles.map(p => ({
      id: p.id, name: p.name, endpoint: p.endpoint, model: p.model, hasKey: p.hasKey
    }))
    await settingsStore.saveSettings(saveData)
    ElMessage.success('设置已保存')
    visible.value = false
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.sd-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 18px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  background: var(--vb-bg-elevated);
}

.sd-tabs button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--vb-radius-sm);
  background: transparent;
  color: var(--vb-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.sd-tabs button:hover {
  color: var(--vb-text);
  background: var(--vb-bg-hover);
}

.sd-tabs button.active {
  color: var(--vb-accent);
  background: var(--vb-accent-bg);
}

.sd-panel {
  min-height: 260px;
}

.path-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.path-setting span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.notice-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  padding: 10px 12px;
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

/* ── 翻译 ── */
.profile-card {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.profile-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--vb-text);
}

.profile-key-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--vb-success-bg);
  color: var(--vb-success);
}
.profile-key-status.missing {
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
}

.profile-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-field label {
  font-size: 12px;
  color: var(--vb-text-secondary);
  font-weight: 500;
}

/* ── B站 ── */
.bili-section {
  padding: 4px 0;
}

.bili-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--vb-text-secondary);
}

.bili-status {
  font-weight: 600;
}
.bili-status.success { color: var(--vb-success); }
.bili-status.muted { color: var(--vb-text-tertiary); }

.bili-actions {
  display: flex;
  gap: 8px;
}

.example-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.example-list code {
  padding: 4px 7px;
  border-radius: var(--vb-radius-xs);
  background: var(--vb-bg-hover);
  color: var(--vb-text-secondary);
}
</style>

<style>
.settings-dialog {
  border-radius: 16px !important;
  overflow: hidden;
}

.settings-dialog .el-dialog__header {
  padding: 20px 24px 0;
}

.settings-dialog .el-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--vb-text);
}

.settings-dialog .el-dialog__body {
  padding: 16px 24px;
}

.settings-dialog .el-dialog__footer {
  padding: 0 24px 20px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-version {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}

.dialog-actions {
  display: flex;
  gap: 8px;
}
</style>
