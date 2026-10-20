
<template>
  <div class="settings-page">
    <main class="settings-content">
      <section v-for="section in sections" :key="section.key" class="settings-section">
        <header class="section-header">
          <div>
            <h2>{{ section.label }}</h2>
            <p>{{ section.description }}</p>
          </div>
        </header>

        <div class="section-body">
          <template v-if="section.key === 'download'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>默认保存目录</strong>
                <span>新建下载任务时默认保存到这里。</span>
              </div>
              <div class="setting-control wide-control">
                <el-input
                  v-model="draft.defaultSavePath"
                  readonly
                  placeholder="例如 D:\\Downloads"
                  :title="draft.defaultSavePath || '未设置'"
                />
                <el-button @click="chooseDownloadPath">选择</el-button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <strong>并发下载数</strong>
                <span>同时执行的下载任务数量。</span>
              </div>
              <div class="setting-control compact-control">
                <el-input-number v-model="draft.concurrentDownloads" :min="1" :max="8" controls-position="right" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <strong>失败自动重试</strong>
                <span>下载失败后自动重试的次数。</span>
              </div>
              <div class="setting-control compact-control">
                <el-input-number v-model="draft.autoRetryCount" :min="0" :max="3" controls-position="right" />
              </div>
            </div>
          </template>

          <template v-else-if="section.key === 'cookie'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>Cookie 来源</strong>
                <span>用于需要登录态的网站解析。</span>
              </div>
              <div class="setting-control compact-control">
                <el-select v-model="draft.cookieMode">
                  <el-option v-for="option in cookieModeOptions" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
              </div>
            </div>

            <div v-if="draft.cookieMode === 'browser'" class="setting-row">
              <div class="setting-copy">
                <strong>浏览器来源</strong>
                <span>从指定浏览器读取站点 Cookie。</span>
              </div>
              <div class="setting-control compact-control">
                <el-select v-model="draft.cookieBrowser">
                  <el-option label="Edge" value="edge" />
                  <el-option label="Chrome" value="chrome" />
                  <el-option label="Firefox" value="firefox" />
                  <el-option label="自定义" value="custom" />
                </el-select>
              </div>
            </div>

            <div v-if="draft.cookieMode === 'file'" class="setting-row">
              <div class="setting-copy">
                <strong>cookies.txt 文件</strong>
                <span>选择本地导出的 cookies.txt 文件。</span>
              </div>
              <div class="setting-control wide-control">
                <el-input
                  v-model="draft.cookiesFile"
                  readonly
                  placeholder="例如 D:\\cookies.txt"
                  :title="draft.cookiesFile || '未选择文件'"
                />
                <el-button @click="chooseCookiesFile">选择文件</el-button>
              </div>
            </div>
          </template>

          <template v-else-if="section.key === 'bilibili'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>登录有效期</strong>
                <span>本地 Cookie 的最长保留时间，过期后需要重新扫码。</span>
              </div>
              <div class="setting-control">
                <el-radio-group v-model="draft.biliCookieHours" size="small">
                  <el-radio-button :value="1">1 小时</el-radio-button>
                  <el-radio-button :value="6">6 小时</el-radio-button>
                  <el-radio-button :value="24">24 小时</el-radio-button>
                  <el-radio-button :value="168">7 天</el-radio-button>
                </el-radio-group>
              </div>
            </div>

            <div class="setting-row setting-row--stack">
              <div class="setting-copy">
                <strong>B站登录</strong>
                <span>登录信息仅保存在本机，不会上传到云端。</span>
              </div>
              <div class="setting-control stacked-control">
                <div class="status-grid">
                  <div>
                    <span>当前状态</span>
                    <strong>{{ biliStatusText }}</strong>
                  </div>
                  <div>
                    <span>账号</span>
                    <strong>{{ biliAccountText }}</strong>
                  </div>
                  <div>
                    <span>失效时间</span>
                    <strong>{{ biliExpireText }}</strong>
                  </div>
                  <div>
                    <span>剩余时长</span>
                    <strong>{{ biliRemainText }}</strong>
                  </div>
                </div>
                <div class="inline-actions">
                  <el-button type="primary" @click="openBiliLoginDialog">{{ biliLoginButtonText }}</el-button>
                  <el-button @click="checkBiliStatus">检查状态</el-button>
                  <el-button plain type="danger" :disabled="!biliState.loggedIn" @click="clearBiliLogin">退出登录</el-button>
                </div>
                <span class="inline-note" :class="biliCheckState">{{ biliCheckText }}</span>
              </div>
            </div>
          </template>

          <template v-else-if="section.key === 'network'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>代理地址</strong>
                <span>支持 HTTP、HTTPS、SOCKS5。</span>
              </div>
              <div class="setting-control wide-control">
                <el-input v-model="draft.proxy" clearable placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:7890" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <strong>连接测试</strong>
                <span>检查当前代理是否可用。</span>
              </div>
              <div class="setting-control action-control">
                <el-button :loading="proxyTesting" @click="testProxyConnection">测试连接</el-button>
                <span class="inline-note" :class="proxyTestState">{{ proxyTestText }}</span>
              </div>
            </div>
          </template>


          <template v-else-if="section.key === 'translate'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>默认翻译方案</strong>
                <span>标题、描述、字幕翻译优先使用这里选中的方案。</span>
              </div>
              <div class="setting-control wide-control">
                <el-select v-model="draft.activeProfileId" placeholder="选择默认方案">
                  <el-option
                    v-for="profile in draft.translateProfiles"
                    :key="profile.id"
                    :label="profile.name || '未命名方案'"
                    :value="profile.id"
                  />
                </el-select>
                <el-button @click="openProfileDrawer()">新增方案</el-button>
              </div>
            </div>

            <div class="translate-list">
              <div v-if="draft.translateProfiles.length === 0" class="empty-state">还没有翻译方案。</div>
              <div v-else class="translate-table">
                <div class="translate-head">
                  <span>名称</span>
                  <span>模型</span>
                  <span>状态</span>
                  <span>操作</span>
                </div>
                <div
                  v-for="profile in draft.translateProfiles"
                  :key="profile.id"
                  class="translate-row"
                  :class="{ active: profile.id === draft.activeProfileId }"
                >
                  <div class="translate-name">
                    <strong>{{ profile.name || '未命名方案' }}</strong>
                    <span v-if="profile.id === draft.activeProfileId">默认</span>
                  </div>
                  <div class="translate-model">{{ profile.model || '未设置' }}</div>
                  <div>
                    <el-tag size="small" effect="plain" :type="profile.hasKey ? 'success' : 'info'">
                      {{ profile.hasKey ? '已配置 Key' : '未配置 Key' }}
                    </el-tag>
                  </div>
                  <div class="translate-actions">
                    <el-button text @click="openProfileDrawer(profile)">编辑</el-button>
                    <el-button text @click="duplicateProfile(profile)">复制</el-button>
                    <el-button text type="danger" @click="removeProfile(profile)">删除</el-button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="section.key === 'resources'">
            <div class="setting-row resource-setting-row">
              <div class="setting-control stacked-control resource-control">
                <div class="resource-list">
                  <div class="resource-item">
                    <div>
                      <strong class="resource-title"><i class="resource-dot resource-dot--purple" />yt-dlp</strong>
                      <span class="resource-meta">
                        {{ resourceVersions?.ytDlp.outdated
                          ? `当前版本 ${formatResourceVersion(resourceVersions.ytDlp.current, 'yt-dlp')} → 最新版本 ${formatResourceVersion(resourceVersions.ytDlp.latest, 'yt-dlp')}`
                          : `版本 ${formatResourceVersion(resourceVersions?.ytDlp.current, 'yt-dlp')}` }}
                      </span>
                    </div>
                    <div class="resource-actions">
                      <el-tag v-if="resourceVersions" size="small" effect="plain" :type="resourceVersions.ytDlp.outdated ? 'warning' : 'success'">
                        {{ resourceVersions.ytDlp.outdated ? '有新版本' : '已是最新' }}
                      </el-tag>
                      <el-button class="resource-update-button" v-if="resourceVersions?.ytDlp.outdated" size="small" type="primary" plain :loading="resourceUpdating === 'yt-dlp'" @click="updateResource('yt-dlp')">
                        立即更新
                      </el-button>
                    </div>
                  </div>
                  <div class="resource-item">
                    <div>
                      <strong class="resource-title"><i class="resource-dot resource-dot--orange" />FFmpeg</strong>
                      <span class="resource-meta">
                        {{ resourceVersions?.ffmpeg.outdated
                          ? `当前版本 ${formatResourceVersion(resourceVersions.ffmpeg.current, 'ffmpeg')} → 最新版本 ${formatResourceVersion(resourceVersions.ffmpeg.latest, 'ffmpeg')}`
                          : `版本 ${formatResourceVersion(resourceVersions?.ffmpeg.current, 'ffmpeg')}` }}
                      </span>
                    </div>
                    <div class="resource-actions">
                      <el-tag v-if="resourceVersions" size="small" effect="plain" :type="resourceVersions.ffmpeg.outdated ? 'warning' : 'success'">
                        {{ resourceVersions.ffmpeg.outdated ? '有新版本' : '已是最新' }}
                      </el-tag>
                      <el-button class="resource-update-button" v-if="resourceVersions?.ffmpeg.outdated" size="small" type="primary" plain :loading="resourceUpdating === 'ffmpeg'" @click="updateResource('ffmpeg')">
                        立即更新
                      </el-button>
                    </div>
                  </div>
                </div>
                <div class="inline-actions">
                  <el-button :loading="resourceChecking" @click="checkResourceVersions">检查更新</el-button>
                  <span class="inline-note" :class="resourceCheckState">{{ resourceCheckText }}</span>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="section.key === 'notify'">
            <div class="setting-row">
              <div class="setting-copy">
                <strong>下载完成通知</strong>
                <span>任务结束后提示结果。</span>
              </div>
              <div class="setting-control compact-control">
                <el-switch v-model="draft.downloadNotifications" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <strong>通知方式</strong>
                <span>系统通知与应用内通知可同时开启。</span>
              </div>
              <div class="setting-control">
                <el-checkbox-group v-model="notificationChannelModel" :disabled="!draft.downloadNotifications">
                  <el-checkbox label="system">系统通知</el-checkbox>
                  <el-checkbox label="in-app">应用内通知</el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </template>
        </div>
      </section>
    </main>

    <footer class="settings-footer">
      <span>ClipPick</span>
      <div class="header-meta">
        <span>版本 {{ version }}</span>
        <span :class="['save-state', saveState]">{{ saveStateText }}</span>
      </div>
    </footer>

    <el-dialog
      v-model="biliLoginVisible"
      title="B站登录"
      width="400px"
      destroy-on-close
      :close-on-click-modal="false"
      @closed="stopBiliPolling"
    >
      <div class="qr-dialog">
        <div class="qr-box">
          <img v-if="biliQrDataUrl" :src="biliQrDataUrl" alt="B站登录二维码" />
          <div v-else class="qr-placeholder">等待生成二维码</div>
        </div>
        <p class="qr-tip">使用 Bilibili App 扫码并在手机上确认。</p>
        <p class="qr-tip qr-tip--subtle">若扫码后提示网页无法打开，请检查手机代理 / VPN 是否影响 Bilibili App。</p>
        <p class="qr-state">{{ biliLoginMessage }}</p>
        <div class="dialog-actions">
          <el-button @click="biliLoginVisible = false">关闭</el-button>
          <el-button :loading="biliQrLoading" @click="refreshBiliQr">刷新二维码</el-button>
        </div>
      </div>
    </el-dialog>

    <el-drawer
      v-model="profileDrawerVisible"
      :title="profileDrawerMode === 'create' ? '新增翻译方案' : '编辑翻译方案'"
      size="420px"
      destroy-on-close
    >
      <el-form ref="profileFormRef" :model="profileForm" :rules="profileFormRules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="profileForm.name" placeholder="例如 DeepSeek 主方案" />
        </el-form-item>

        <el-form-item label="厂商" prop="vendor">
          <el-select v-model="profileForm.vendor">
            <el-option v-for="preset in providerPresets" :key="preset.value" :label="preset.label" :value="preset.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="Endpoint" prop="endpoint">
          <el-input v-model="profileForm.endpoint" placeholder="https://api.deepseek.com" />
        </el-form-item>

        <el-form-item label="Model" prop="model">
          <el-input v-model="profileForm.model" placeholder="deepseek-v4-pro" />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="profileForm.apiKey"
            :type="profileKeyVisible ? 'text' : 'password'"
            :placeholder="profileDrawerMode === 'edit' && draftProfileHasKey ? '留空则保留现有 Key' : '请输入 API Key'"
          >
            <template #suffix>
              <button type="button" class="suffix-button" @click="profileKeyVisible = !profileKeyVisible">
                {{ profileKeyVisible ? '隐藏' : '显示' }}
              </button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <div class="drawer-status" :class="profileTestState">{{ profileTestText }}</div>

      <template #footer>
        <div class="dialog-actions drawer-actions">
          <el-button :loading="profileTestLoading" @click="testProfileConnection">测试连接</el-button>
          <el-button @click="profileDrawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="profileSaving" @click="saveProfileDrawer">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import QRCode from 'qrcode'
import { useSettingsStore } from '../stores/settings.store'
import type { AppSettings, BiliLoginState, TranslateProfile, VersionCheckResult } from '../../../shared/types'

type SectionKey = 'download' | 'cookie' | 'bilibili' | 'network' | 'resources' | 'translate' | 'notify'
type ProviderKey = 'deepseek' | 'minimax' | 'moonshot' | 'zhipu' | 'xiaomi' | 'custom'

interface ProviderPreset {
  value: ProviderKey
  label: string
  endpoint: string
  model: string
}

interface ProfileFormState {
  id: string
  name: string
  vendor: ProviderKey
  endpoint: string
  model: string
  apiKey: string
}

const settingsStore = useSettingsStore()
const version = ref('1.0.0')
const draft = reactive<AppSettings>(cloneSettings(settingsStore.settings))

const sections: Array<{ key: SectionKey; label: string; description: string }> = [
  { key: 'download', label: '下载', description: '管理保存位置、并发任务和失败重试。' },
  { key: 'cookie', label: 'Cookie', description: '为需要登录权限的网站提供本地 Cookie。' },
  { key: 'bilibili', label: 'B站登录', description: '扫码登录后，可访问需要账号权限的内容。' },
  { key: 'network', label: '网络', description: '配置代理，并测试当前网络连接。' },
  { key: 'resources', label: '资源', description: '检查内置下载和媒体处理组件的版本。' },
  { key: 'translate', label: '翻译', description: '配置标题、描述和字幕的翻译方案。' },
  { key: 'notify', label: '通知', description: '设置下载完成后的提醒方式。' }
]

const cookieModeOptions = [
  { label: '自动', value: 'auto' },
  { label: '浏览器', value: 'browser' },
  { label: '文件', value: 'file' },
  { label: '关闭', value: 'none' }
] as const

const providerPresets: ProviderPreset[] = [
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
  { value: 'minimax', label: 'MiniMax', endpoint: 'https://api.minimaxi.com/v1', model: 'abab6.5s-chat' },
  { value: 'moonshot', label: 'Moonshot', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { value: 'zhipu', label: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { value: 'xiaomi', label: 'Xiaomi MiMo', endpoint: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro' },
  { value: 'custom', label: '自定义', endpoint: '', model: '' }
]
const biliState = ref<BiliLoginState>({ loggedIn: false, expired: false })
const biliCheckState = ref<'idle' | 'success' | 'error'>('idle')
const biliCheckText = ref('未检查')
const biliLoginVisible = ref(false)
const biliQrLoading = ref(false)
const biliQrDataUrl = ref('')
const biliQrKey = ref('')
const biliLoginMessage = ref('点击登录生成二维码')
const biliPollTimer = ref<ReturnType<typeof setInterval> | null>(null)

const proxyTesting = ref(false)
const proxyTestState = ref<'idle' | 'success' | 'error'>('idle')
const proxyTestText = ref('未测试')

const resourceVersions = ref<VersionCheckResult | null>(null)
const resourceChecking = ref(false)
const resourceUpdating = ref<'yt-dlp' | 'ffmpeg' | null>(null)
const resourceCheckState = ref<'idle' | 'success' | 'error'>('idle')
const resourceCheckText = ref('尚未检查')

const saveState = ref<'idle' | 'saving' | 'error'>('idle')
const savingBusy = ref(false)
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const saveQueued = ref(false)
const isSyncingFromStore = ref(false)

const profileDrawerVisible = ref(false)
const profileDrawerMode = ref<'create' | 'edit'>('create')
const profileFormRef = ref<FormInstance>()
const profileSaving = ref(false)
const profileTestLoading = ref(false)
const profileTestState = ref<'idle' | 'success' | 'error'>('idle')
const profileTestText = ref('未测试')
const profileKeyVisible = ref(false)
const draftProfileHasKey = ref(false)

const profileForm = reactive<ProfileFormState>({
  id: '',
  name: '',
  vendor: 'deepseek',
  endpoint: '',
  model: '',
  apiKey: ''
})

const profileFormRules: FormRules<ProfileFormState> = {
  name: [{ required: true, message: '请输入方案名称', trigger: 'blur' }],
  vendor: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  endpoint: [{ validator: validateEndpoint, trigger: ['blur', 'change'] }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  apiKey: [{ validator: validateApiKey, trigger: 'blur' }]
}

const saveStateText = computed(() => {
  if (saveState.value === 'saving') return '保存中...'
  if (saveState.value === 'error') return '保存失败'
  return '已保存'
})

const biliStatusText = computed(() => {
  if (!biliState.value.loggedIn) return '未登录'
  return biliState.value.expired ? '已失效' : '已登录'
})
const biliAccountText = computed(() => biliState.value.nickname || '未登录')
const biliExpireText = computed(() => formatDateTime(biliState.value.expiresAt))
const biliRemainText = computed(() => biliState.value.expiresInText || (biliState.value.loggedIn ? '未知' : '未登录'))
const biliLoginButtonText = computed(() => (biliState.value.loggedIn ? '重新登录' : '扫码登录'))

const notificationChannelModel = computed<string[]>({
  get() {
    if (!draft.downloadNotifications) return []
    if (draft.notificationMode === 'both') return ['system', 'in-app']
    if (draft.notificationMode === 'in-app') return ['in-app']
    return ['system']
  },
  set(values) {
    const picked = Array.from(new Set(values))
    if (picked.includes('system') && picked.includes('in-app')) {
      draft.notificationMode = 'both'
      return
    }
    draft.notificationMode = picked.includes('in-app') ? 'in-app' : 'system'
  }
})

watch(
  draft,
  () => {
    if (isSyncingFromStore.value) return
    scheduleSave()
  },
  { deep: true }
)

watch(
  () => profileForm.vendor,
  vendor => {
    const preset = providerPresets.find(item => item.value === vendor)
    if (!preset || vendor === 'custom') return
    profileForm.endpoint = preset.endpoint
    profileForm.model = preset.model
  }
)

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings)) as AppSettings
}

function ensureProfiles() {
  if (!draft.translateProfiles.length) {
    draft.translateProfiles = [{
      id: 'deepseek',
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      hasKey: false
    }]
    draft.activeProfileId = 'deepseek'
    return
  }

  if (!draft.activeProfileId || !draft.translateProfiles.some(item => item.id === draft.activeProfileId)) {
    draft.activeProfileId = draft.translateProfiles[0]?.id || ''
  }
}

function applyStoreToDraft() {
  isSyncingFromStore.value = true
  Object.assign(draft, cloneSettings(settingsStore.settings))
  ensureProfiles()
  isSyncingFromStore.value = false
}

function scheduleSave() {
  if (savingBusy.value) {
    saveQueued.value = true
    return
  }
  if (saveTimer.value) clearTimeout(saveTimer.value)
  saveTimer.value = setTimeout(() => {
    saveTimer.value = null
    void persistSettings()
  }, 220)
}

async function persistSettings() {
  if (savingBusy.value) return
  savingBusy.value = true
  saveState.value = 'saving'

  try {
    const updated = await settingsStore.saveSettings(cloneSettings(draft))
    isSyncingFromStore.value = true
    Object.assign(draft, cloneSettings(updated))
    ensureProfiles()
    isSyncingFromStore.value = false
    saveState.value = 'idle'
  } catch {
    saveState.value = 'error'
  } finally {
    savingBusy.value = false
    if (saveQueued.value) {
      saveQueued.value = false
      scheduleSave()
    }
  }
}

async function refreshMeta() {
  try {
    version.value = await window.api.getAppVersion()
  } catch {
    version.value = '1.0.0'
  }
}

async function checkResourceVersions() {
  if (resourceChecking.value) return
  resourceChecking.value = true
  resourceCheckState.value = 'idle'
  resourceCheckText.value = '检查中...'

  try {
    const result = await window.api.checkVersions()
    resourceVersions.value = result
    const outdated = result.ytDlp.outdated || result.ffmpeg.outdated
    resourceCheckState.value = outdated ? 'error' : 'success'
    resourceCheckText.value = outdated ? '检测到资源更新' : '资源已是最新'
  } catch (error) {
    resourceCheckState.value = 'error'
    resourceCheckText.value = error instanceof Error ? error.message : '检查失败，请稍后重试'
  } finally {
    resourceChecking.value = false
  }
}

async function updateResource(resource: 'yt-dlp' | 'ffmpeg') {
  if (resourceUpdating.value) return
  resourceUpdating.value = resource
  resourceCheckState.value = 'idle'
  resourceCheckText.value = `正在下载并替换 ${resource}...`

  try {
    const result = await window.api.updateResource(resource)
    if (resourceVersions.value) {
      const key = resource === 'yt-dlp' ? 'ytDlp' : 'ffmpeg'
      resourceVersions.value[key] = {
        ...resourceVersions.value[key],
        current: result.version,
        latest: result.version,
        outdated: false
      }
    }
    resourceCheckState.value = 'success'
    resourceCheckText.value = `${resource} 更新完成`
    ElMessage.success(`${resource} 已下载并替换成功`)
  } catch (error) {
    resourceCheckState.value = 'error'
    resourceCheckText.value = error instanceof Error ? error.message : '资源更新失败'
    ElMessage.error(resourceCheckText.value)
  } finally {
    resourceUpdating.value = null
  }
}

async function loadDraft() {
  if (!settingsStore.loaded) {
    await settingsStore.loadFromLocal()
  }
  applyStoreToDraft()
}

async function chooseDownloadPath() {
  const result = await window.api.selectSavePath()
  if (result) draft.defaultSavePath = result
}

async function chooseCookiesFile() {
  const result = await window.api.selectFilePath()
  if (result) {
    draft.cookiesFile = result
    draft.cookieMode = 'file'
  }
}

async function testProxyConnection() {
  proxyTesting.value = true
  proxyTestState.value = 'idle'
  proxyTestText.value = '测试中...'

  try {
    const result = await window.api.testProxy(draft.proxy.trim())
    proxyTestState.value = result.ok ? 'success' : 'error'
    proxyTestText.value = result.message
  } catch (error) {
    proxyTestState.value = 'error'
    proxyTestText.value = error instanceof Error ? error.message : '连接失败'
  } finally {
    proxyTesting.value = false
  }
}

async function refreshBiliState() {
  try {
    biliState.value = await window.api.getBiliState()
  } catch {
    biliState.value = { loggedIn: false, expired: false }
  }
}

async function checkBiliStatus() {
  try {
    const [state, expired] = await Promise.all([
      window.api.getBiliState(),
      window.api.checkBiliCookies()
    ])

    biliState.value = state
    biliCheckState.value = expired ? 'error' : 'success'
    biliCheckText.value = !state.loggedIn ? '未登录' : expired ? 'Cookie 已失效' : 'Cookie 可用'
  } catch (error) {
    biliCheckState.value = 'error'
    biliCheckText.value = error instanceof Error ? error.message : '检查失败'
  }
}

async function openBiliLoginDialog() {
  biliLoginVisible.value = true
  await refreshBiliQr()
}

async function refreshBiliQr() {
  stopBiliPolling()
  biliQrLoading.value = true
  biliLoginMessage.value = '正在生成二维码...'

  try {
    const result = await window.api.generateBiliQr()
    biliQrKey.value = result.qrcode_key
    biliQrDataUrl.value = await QRCode.toDataURL(result.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220
    })
    biliLoginMessage.value = '请使用 Bilibili App 扫码确认。'
    startBiliPolling()
  } catch (error) {
    biliLoginMessage.value = error instanceof Error ? error.message : '二维码生成失败'
    ElMessage.error(biliLoginMessage.value)
  } finally {
    biliQrLoading.value = false
  }
}

function startBiliPolling() {
  if (!biliQrKey.value) return

  biliPollTimer.value = setInterval(async () => {
    try {
      const result = await window.api.pollBiliLogin(biliQrKey.value)
      if (result.status === 'confirmed') {
        stopBiliPolling()
        biliLoginMessage.value = '登录成功'
        biliLoginVisible.value = false
        await refreshBiliState()
        biliCheckState.value = 'success'
        biliCheckText.value = 'Cookie 可用'
        ElMessage.success('B站登录成功')
      } else if (result.status === 'scanned') {
        biliLoginMessage.value = '已扫码，请在手机上确认。'
      } else if (result.status === 'expired') {
        stopBiliPolling()
        biliLoginMessage.value = '二维码已过期，请刷新。'
      }
    } catch {
      // keep polling
    }
  }, 2000)
}
function stopBiliPolling() {
  if (biliPollTimer.value) {
    clearInterval(biliPollTimer.value)
    biliPollTimer.value = null
  }
}

async function clearBiliLogin() {
  try {
    await ElMessageBox.confirm('确定退出当前 B站 登录吗？本地 Cookie 会被删除。', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出登录',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  await window.api.clearBiliCookies()
  biliState.value = { loggedIn: false, expired: false }
  biliCheckState.value = 'idle'
  biliCheckText.value = '未登录'
  ElMessage.success('已退出 B站 登录')
}

function normalizeVendor(profile: TranslateProfile): ProviderKey {
  const preset = providerPresets.find(item => item.endpoint === profile.endpoint && item.model === profile.model)
  return preset?.value || 'custom'
}

function openProfileDrawer(profile?: TranslateProfile) {
  profileDrawerVisible.value = true
  profileDrawerMode.value = profile ? 'edit' : 'create'
  profileKeyVisible.value = false
  profileTestState.value = 'idle'
  profileTestText.value = '未测试'

  if (profile) {
    profileForm.id = profile.id
    profileForm.name = profile.name
    profileForm.vendor = normalizeVendor(profile)
    profileForm.endpoint = profile.endpoint
    profileForm.model = profile.model
    profileForm.apiKey = ''
    draftProfileHasKey.value = profile.hasKey
    return
  }

  profileForm.id = `profile-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  profileForm.name = '新方案'
  profileForm.vendor = 'deepseek'
  profileForm.endpoint = providerPresets[0].endpoint
  profileForm.model = providerPresets[0].model
  profileForm.apiKey = ''
  draftProfileHasKey.value = false
}

function duplicateProfile(profile: TranslateProfile) {
  draft.translateProfiles.push({
    id: `profile-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: `${profile.name || '未命名方案'} 副本`,
    endpoint: profile.endpoint,
    model: profile.model,
    hasKey: false
  })
  draft.activeProfileId = draft.translateProfiles[draft.translateProfiles.length - 1]?.id || draft.activeProfileId
}

async function removeProfile(profile: TranslateProfile) {
  try {
    await ElMessageBox.confirm(`确定删除翻译方案“${profile.name || '未命名方案'}”吗？`, '删除方案', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  draft.translateProfiles = draft.translateProfiles.filter(item => item.id !== profile.id)
  if (draft.activeProfileId === profile.id) {
    draft.activeProfileId = draft.translateProfiles[0]?.id || ''
  }
}

async function testProfileConnection() {
  const form = profileFormRef.value
  if (form) {
    const valid = await form.validate().catch(() => false)
    if (!valid) return
  }

  profileTestLoading.value = true
  profileTestState.value = 'idle'
  profileTestText.value = '测试中...'

  try {
    if (profileForm.apiKey.trim()) {
      const result = await window.api.testTranslateProfile({
        endpoint: profileForm.endpoint.trim(),
        model: profileForm.model.trim(),
        apiKey: profileForm.apiKey.trim()
      })
      profileTestState.value = result.ok ? 'success' : 'error'
      profileTestText.value = result.message
      return
    }

    if (profileDrawerMode.value === 'edit' && draftProfileHasKey.value) {
      const result = await window.api.translateText({
        text: '测试连接',
        profileId: profileForm.id
      })
      profileTestState.value = result.translatedText ? 'success' : 'error'
      profileTestText.value = result.translatedText ? '连接成功' : '连接失败'
      return
    }

    profileTestState.value = 'error'
    profileTestText.value = '请先输入 API Key'
  } catch (error) {
    profileTestState.value = 'error'
    profileTestText.value = error instanceof Error ? error.message : '连接失败'
  } finally {
    profileTestLoading.value = false
  }
}

async function saveProfileDrawer() {
  const form = profileFormRef.value
  if (form) {
    const valid = await form.validate().catch(() => false)
    if (!valid) return
  }

  profileSaving.value = true
  try {
    const normalized: TranslateProfile = {
      id: profileForm.id,
      name: profileForm.name.trim(),
      endpoint: profileForm.endpoint.trim(),
      model: profileForm.model.trim(),
      hasKey: draftProfileHasKey.value
    }

    const index = draft.translateProfiles.findIndex(item => item.id === normalized.id)
    if (index >= 0) {
      draft.translateProfiles[index] = normalized
    } else {
      draft.translateProfiles.push(normalized)
    }

    if (!draft.activeProfileId) {
      draft.activeProfileId = normalized.id
    }

    if (profileForm.apiKey.trim()) {
      await settingsStore.setApiKey(normalized.id, profileForm.apiKey.trim())
      normalized.hasKey = true
      const nextIndex = draft.translateProfiles.findIndex(item => item.id === normalized.id)
      if (nextIndex >= 0) {
        draft.translateProfiles[nextIndex].hasKey = true
      }
    }

    await persistSettings()
    profileDrawerVisible.value = false
    ElMessage.success('翻译方案已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    profileSaving.value = false
  }
}

function validateEndpoint(_rule: unknown, value: string, callback: (err?: Error) => void) {
  const text = value.trim()
  if (!text) {
    callback(new Error('请输入 Endpoint'))
    return
  }

  try {
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol)) {
      callback(new Error('Endpoint 仅支持 http 或 https'))
      return
    }
    callback()
  } catch {
    callback(new Error('请输入有效的 URL'))
  }
}

function validateApiKey(_rule: unknown, value: string, callback: (err?: Error) => void) {
  if (!value) {
    callback()
    return
  }
  if (value.trim().length < 8) {
    callback(new Error('API Key 太短，请检查后重试'))
    return
  }
  callback()
}

function formatDateTime(value?: string) {
  if (!value) return '未登录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatResourceVersion(value: string | undefined, resource: 'yt-dlp' | 'ffmpeg'): string {
  if (!value || value === 'unknown') return '未知'
  if (resource === 'ffmpeg') {
    const match = value.match(/\bversion\s+([^\s]+)/i)
    if (match?.[1]) return match[1]
  }
  return value.trim().split(/\s+/)[0]
}

onMounted(async () => {
  await loadDraft()
  await refreshMeta()
  await checkResourceVersions()
  await refreshBiliState()
  await checkBiliStatus()
})

onBeforeUnmount(() => {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  stopBiliPolling()
})
</script>

<style scoped>
.settings-page {
  height: 100%;
  padding: 20px 24px 28px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--vb-bg);
}

.header-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--vb-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 2px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.settings-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 2px 4px 10px 2px;
}

.settings-section {
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--vb-border-light);
  border-radius: 12px;
  background: var(--vb-bg-surface);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 13px;
  background: var(--vb-bg-elevated);
}

.section-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--vb-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.section-body {
  padding: 0 18px;
}

.setting-row {
  min-height: 72px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(280px, 480px);
  gap: 20px;
  align-items: center;
  padding: 14px 0;
  border-top: 1px solid var(--vb-border-light);
}

.setting-row:first-child {
  border-top: 0;
}

.setting-row--stack {
  align-items: start;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-copy strong {
  font-size: 14px;
  font-weight: 600;
}

.setting-copy span {
  color: var(--vb-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.setting-control {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.setting-control :deep(.el-input),
.setting-control :deep(.el-select) {
  width: 100%;
}

.compact-control {
  max-width: 220px;
}

.wide-control {
  width: 100%;
}

.action-control {
  justify-content: flex-start;
}

.stacked-control {
  align-items: flex-start;
  flex-direction: column;
}

.resource-setting-row {
  display: block;
  padding-top: 16px;
}

.resource-control {
  width: 100%;
}

.status-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.status-grid div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.status-grid span {
  color: var(--vb-text-tertiary);
  font-size: 11px;
}

.status-grid strong {
  font-size: 13px;
  font-weight: 600;
  word-break: break-word;
}

.resource-list {
  width: 100%;
  display: grid;
  gap: 8px;
}

.resource-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 10px 12px 10px 14px;
  border: 1px solid var(--vb-border-light);
  border-radius: 10px;
  background: linear-gradient(135deg, var(--vb-bg-soft), var(--vb-bg-surface));
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.resource-item:hover {
  border-color: rgba(108, 92, 231, 0.28);
  box-shadow: 0 5px 14px rgba(44, 39, 82, 0.06);
}

.resource-item > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.resource-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.resource-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}

.resource-item > div:first-child > span {
  color: var(--vb-text-tertiary);
  font-size: 12px;
  word-break: break-word;
}

.resource-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
}

.resource-dot--purple { background: #7566e8; }
.resource-dot--orange { background: #e79a43; }

.resource-actions :deep(.resource-update-button) {
  min-width: 76px;
  height: 30px;
  font-weight: 500;
}

.resource-actions :deep(.el-button--primary.is-plain) {
  color: var(--vb-primary);
  border-color: rgba(108, 92, 231, 0.28);
  background: rgba(108, 92, 231, 0.06);
}

.resource-actions :deep(.el-button--primary.is-plain:hover),
.resource-actions :deep(.el-button--primary.is-plain:focus) {
  color: #fff;
  border-color: var(--vb-primary);
  background: var(--vb-primary);
}

.inline-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.inline-note {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  font-size: 12px;
  color: var(--vb-text-tertiary);
}

.inline-note.success,
.save-state.idle,
.drawer-status.success {
  color: var(--vb-success);
}

.inline-note.error,
.save-state.error,
.drawer-status.error {
  color: var(--vb-danger);
}

.save-state.saving {
  color: var(--vb-text-secondary);
}

.translate-list {
  padding: 4px 0 12px;
}

.empty-state {
  padding: 8px 0;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.translate-table {
  overflow-x: auto;
}

.translate-head,
.translate-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(180px, 1fr) 130px 220px;
  gap: 12px;
  align-items: center;
  min-width: 720px;
}

.translate-head {
  padding: 8px 0 10px;
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.translate-row {
  padding: 12px 0;
  border-top: 1px solid var(--vb-border-light);
  font-size: 13px;
}

.translate-row.active {
  background: rgba(108, 92, 231, 0.04);
}

.translate-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.translate-name strong {
  font-size: 14px;
}

.translate-name span {
  color: var(--vb-accent);
  font-size: 11px;
}

.translate-model {
  color: var(--vb-text-secondary);
}

.translate-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.translate-actions :deep(.el-button) {
  margin-left: 0;
  padding: 0 4px;
}

.qr-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 2px;
}

.qr-box {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vb-border-light);
  border-radius: 12px;
  background: #fff;
}

.qr-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder,
.qr-tip,
.qr-state,
.drawer-status {
  color: var(--vb-text-secondary);
  font-size: 12px;
}

.qr-tip,
.qr-state {
  margin: 0;
  text-align: center;
  max-width: 320px;
}

.qr-tip--subtle {
  color: var(--vb-text-tertiary);
  line-height: 1.6;
}

.dialog-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.drawer-actions {
  justify-content: flex-end;
}

.suffix-button {
  border: 0;
  background: transparent;
  color: var(--vb-accent);
  cursor: pointer;
  padding: 0;
  font: inherit;
}

@media (max-width: 960px) {
  .setting-row {
    grid-template-columns: 1fr;
  }

  .setting-control,
  .translate-actions {
    justify-content: flex-start;
  }

  .compact-control {
    max-width: 100%;
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 16px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .qr-box {
    width: min(220px, 100%);
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .settings-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>

