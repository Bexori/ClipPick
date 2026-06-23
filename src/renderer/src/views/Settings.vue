<template>
  <div class="settings-page">
    <main class="settings-content">
      <div class="content-inner">
          <section
            v-for="section in sections"
            :key="section.key"
            class="settings-section"
          >
            <header class="section-header">
              <h2>{{ section.label }}</h2>
            </header>

            <div class="section-rows">
              <template v-if="section.key === 'download'">
                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>默认保存目录</strong>
                    <span>新建下载任务时默认保存到该目录。</span>
                  </div>
                  <div class="setting-control">
                    <div class="path-control">
                      <el-input
                        v-model="draft.defaultSavePath"
                        class="control-field path-input"
                        placeholder="例如 D:\\Downloads"
                        readonly
                        :title="draft.defaultSavePath || defaultDownloadPath"
                      />
                      <el-button @click="chooseDownloadPath">选择</el-button>
                    </div>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>并发下载数</strong>
                    <span>同时进行的下载任务数量，过高可能影响速度和稳定性。</span>
                  </div>
                  <div class="setting-control">
                    <el-input-number v-model="draft.concurrentDownloads" :min="1" :max="5" controls-position="right" />
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>失败重试次数</strong>
                    <span>下载失败后自动重试的次数。</span>
                  </div>
                  <div class="setting-control">
                    <el-input-number v-model="draft.autoRetryCount" :min="0" :max="10" controls-position="right" />
                  </div>
                </div>
              </template>

              <template v-else-if="section.key === 'cookieLogin'">
                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>Cookie 来源</strong>
                    <span>选择 Cookie 的读取方式，用于需要登录状态的网站解析。</span>
                  </div>
                  <div class="setting-control">
                    <el-select v-model="draft.cookieMode" class="control-field">
                      <el-option label="不使用 Cookie" value="none" />
                      <el-option label="从浏览器读取" value="browser" />
                      <el-option label="使用 cookies.txt 文件" value="file" />
                    </el-select>
                  </div>
                </div>

                <div v-if="draft.cookieMode === 'browser'" class="setting-row">
                  <div class="setting-copy">
                    <strong>浏览器来源选择</strong>
                    <span>Cookie 来源为“从浏览器读取”时，选择读取的浏览器。</span>
                  </div>
                  <div class="setting-control">
                    <el-select v-model="draft.cookieBrowser" class="control-field">
                      <el-option label="Chrome" value="chrome" />
                      <el-option label="Edge" value="edge" />
                      <el-option label="Firefox" value="firefox" />
                      <el-option label="自定义" value="custom" />
                    </el-select>
                  </div>
                </div>

                <div v-if="draft.cookieMode === 'file'" class="setting-row">
                  <div class="setting-copy">
                    <strong>cookies.txt 文件路径</strong>
                    <span>Cookie 来源为“使用 cookies.txt 文件”时，选择本地 Cookie 文件。</span>
                  </div>
                  <div class="setting-control">
                    <div class="path-control">
                      <el-input
                        v-model="draft.cookiesFile"
                        class="control-field path-input"
                        placeholder="例如 D:\\cookies.txt"
                        readonly
                        :title="draft.cookiesFile || '请选择 cookies.txt 文件'"
                      />
                      <el-button @click="chooseCookiesFile">选择文件</el-button>
                    </div>
                  </div>
                </div>

                <div class="setting-row setting-row--bili">
                  <div class="setting-copy">
                    <strong>B 站登录状态</strong>
                    <span>查看当前账号 Cookie 是否有效，并进行登录或清除。</span>
                  </div>
                  <div class="setting-control">
                    <div class="bili-status">
                      <div class="bili-status__grid">
                        <div>
                          <span>当前状态</span>
                          <strong>{{ biliStateLabel }}</strong>
                        </div>
                        <div>
                          <span>账号</span>
                          <strong>{{ biliAccountLabel }}</strong>
                        </div>
                        <div>
                          <span>有效期</span>
                          <strong>{{ biliExpiryLabel }}</strong>
                        </div>
                        <div class="bili-status__path">
                          <span>Cookie 存储路径</span>
                          <strong>{{ biliCookiesPathLabel }}</strong>
                        </div>
                      </div>
                      <div class="inline-actions">
                        <el-button type="primary" @click="openBiliLoginDialog">
                          {{ biliState.loggedIn ? '重新登录' : '扫码登录' }}
                        </el-button>
                        <el-button @click="checkBiliStatus">检查状态</el-button>
                        <el-button plain type="danger" :disabled="!biliState.loggedIn" @click="clearBiliLogin">清除登录</el-button>
                      </div>
                      <div class="status-note" :class="biliCheckStateClass">{{ biliCheckLabel }}</div>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="section.key === 'network'">
                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>代理地址</strong>
                    <span>配置下载和解析请求使用的代理，支持 HTTP / HTTPS / SOCKS5。</span>
                  </div>
                  <div class="setting-control">
                    <el-input
                      v-model="draft.proxy"
                      class="control-field"
                        placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:7890"
                      clearable
                    />
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>测试连接</strong>
                    <span>检查当前代理是否可用。</span>
                  </div>
                  <div class="setting-control">
                    <div class="inline-actions inline-actions--left">
                      <el-button :loading="proxyTesting" @click="testProxyConnection">测试连接</el-button>
                      <span class="inline-result" :class="proxyTestStateClass">{{ proxyTestLabel }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="section.key === 'translate'">
                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>默认翻译方案</strong>
                    <span>选择字幕、标题、简介等内容默认使用的翻译配置。</span>
                  </div>
                  <div class="setting-control">
                    <el-select
                      v-model="draft.activeProfileId"
                      class="control-field"
                      :placeholder="draft.translateProfiles.length ? '选择默认翻译方案' : '暂无翻译方案'"
                    >
                      <el-option
                        v-for="profile in draft.translateProfiles"
                        :key="profile.id"
                        :label="profile.name || '未命名方案'"
                        :value="profile.id"
                      />
                    </el-select>
                  </div>
                </div>

                <div class="translate-toolbar">
                  <el-button plain @click="openProfileDrawer()">
                    <el-icon><Plus /></el-icon>
                    新增方案
                  </el-button>
                </div>

                <div class="translate-list">
                  <div v-if="draft.translateProfiles.length === 0" class="empty-state">
                    暂无翻译方案，可新增一个用于字幕和文本翻译。
                  </div>

                  <template v-else>
                    <div class="translate-head">
                      <span>方案名称</span>
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
                          {{ profile.hasKey ? '可用' : '未配置 Key' }}
                        </el-tag>
                      </div>
                      <div class="translate-actions">
                        <el-button text @click="openProfileDrawer(profile)">编辑</el-button>
                        <el-button text @click="duplicateProfile(profile)">复制</el-button>
                        <el-button text type="danger" @click="removeProfile(profile)">删除</el-button>
                      </div>
                    </div>
                  </template>
                </div>
              </template>

              <template v-else-if="section.key === 'notify'">
                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>下载完成通知</strong>
                    <span>下载任务完成后是否提醒。</span>
                  </div>
                  <div class="setting-control">
                    <el-switch v-model="draft.downloadNotifications" />
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-copy">
                    <strong>通知渠道</strong>
                    <span>系统通知和应用内通知可以同时选择。</span>
                  </div>
                  <div class="setting-control">
                    <el-checkbox-group v-model="notificationChannelModel" class="checkbox-group" :disabled="!draft.downloadNotifications">
                      <el-checkbox label="system">系统通知</el-checkbox>
                      <el-checkbox label="in-app">应用内通知</el-checkbox>
                    </el-checkbox-group>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </div>
      </main>

    <el-dialog
      v-model="biliLoginVisible"
      title="B 站扫码登录"
      width="460px"
      destroy-on-close
      class="qr-dialog"
      :close-on-click-modal="false"
    >
      <div class="qr-dialog__body">
        <div class="qr-dialog__canvas">
          <img v-if="biliQrDataUrl" :src="biliQrDataUrl" alt="B 站登录二维码" />
          <div v-else class="qr-placeholder">等待生成二维码</div>
        </div>
        <div class="qr-dialog__meta">
          <p>{{ biliQrTip }}</p>
          <div class="inline-actions inline-actions--left">
            <el-button :loading="biliQrLoading" @click="refreshBiliQr">刷新二维码</el-button>
            <el-button plain @click="biliLoginVisible = false">取消登录</el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-drawer
      v-model="profileDrawerVisible"
      :title="profileDrawerMode === 'create' ? '新增翻译方案' : '编辑翻译方案'"
      size="420px"
      destroy-on-close
    >
      <el-form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileFormRules"
        label-position="top"
        class="profile-form"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="profileForm.name" placeholder="例如 DeepSeek 标准方案" />
        </el-form-item>

        <el-form-item label="厂商" prop="vendor">
          <el-select v-model="profileForm.vendor" placeholder="选择厂商">
            <el-option
              v-for="preset in providerPresets"
              :key="preset.value"
              :label="preset.label"
              :value="preset.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Endpoint" prop="endpoint">
          <el-input v-model="profileForm.endpoint" placeholder="https://api.deepseek.com/v1" />
        </el-form-item>

        <el-form-item label="Model" prop="model">
          <el-input v-model="profileForm.model" placeholder="deepseek-chat" />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="profileForm.apiKey"
            :type="profileKeyVisible ? 'text' : 'password'"
            :placeholder="profileDrawerMode === 'edit' && draftProfileHasKey ? '留空保持现有密钥' : '请输入 API Key'"
          >
            <template #suffix>
              <button type="button" class="suffix-toggle" @click="profileKeyVisible = !profileKeyVisible">
                {{ profileKeyVisible ? '隐藏' : '显示' }}
              </button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <div class="drawer-status">{{ profileTestLabel }}</div>

      <template #footer>
        <div class="drawer-footer">
          <el-button :loading="profileTestLoading" @click="testProfileConnection">测试连接</el-button>
          <el-button @click="profileDrawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="profileSaving" @click="saveProfileDrawer">保存方案</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import QRCode from 'qrcode'
import { Plus, UserFilled } from '@element-plus/icons-vue'
import { useSettingsStore } from '../stores/settings.store'
import type { AppSettings, BiliLoginState, TranslateProfile } from '../../../shared/types'

type SectionKey = 'download' | 'cookieLogin' | 'network' | 'translate' | 'notify'
type ProviderKey = 'deepseek' | 'minimax' | 'moonshot' | 'zhipu' | 'custom'

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
const savingBusy = ref(false)
const saveState = ref<'idle' | 'saving' | 'error'>('idle')
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isSyncingFromStore = ref(false)
const saveQueued = ref(false)

const biliState = ref<BiliLoginState>({ loggedIn: false, expired: false })
const biliCheckText = ref('未检查')
const biliLoginVisible = ref(false)
const biliQrLoading = ref(false)
const biliQrDataUrl = ref('')
const biliQrKey = ref('')
const biliPollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const biliLoginMessage = ref('点击扫码登录生成二维码。')

const proxyTesting = ref(false)
const proxyTestState = ref<'idle' | 'success' | 'error'>('idle')
const proxyTestText = ref('未测试')

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

const sections = [
  { key: 'download', label: '下载' },
  { key: 'cookieLogin', label: 'Cookie 与登录' },
  { key: 'network', label: '网络' },
  { key: 'translate', label: '翻译' },
  { key: 'notify', label: '通知' }
] as const

const providerPresets: ProviderPreset[] = [
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { value: 'minimax', label: 'MiniMax', endpoint: 'https://api.minimaxi.com/v1', model: 'abab6.5s-chat' },
  { value: 'moonshot', label: 'Moonshot', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { value: 'zhipu', label: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { value: 'custom', label: '自定义', endpoint: '', model: '' }
]

const profileFormRules: FormRules<ProfileFormState> = {
  name: [{ required: true, message: '请输入方案名称', trigger: 'blur' }],
  vendor: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  endpoint: [
    { required: true, message: '请输入 Endpoint', trigger: 'blur' },
    { validator: validateEndpoint, trigger: 'blur' }
  ],
  model: [{ required: true, message: '请输入 Model', trigger: 'blur' }],
  apiKey: [{ validator: validateApiKey, trigger: 'blur' }]
}

const defaultDownloadPath = computed(() => settingsStore.defaultSavePath || '使用系统默认下载目录')
const biliStateLabel = computed(() => {
  if (!biliState.value.loggedIn) return '未登录'
  return biliState.value.expired ? '已失效' : '已登录'
})

const biliAccountLabel = computed(() => biliState.value.nickname || 'B 站账号')
const biliExpiryLabel = computed(() => biliState.value.expiresInText || '未知')
const biliCookiesPathLabel = computed(() => biliState.value.cookiesPath || '未生成')
const biliCheckLabel = computed(() => {
  if (biliCheckText.value === '未检查') return '未检查'
  return biliCheckText.value
})
const biliCheckStateClass = computed(() => ({
  success: biliCheckLabel.value.includes('通过') || biliCheckLabel.value.includes('可用'),
  error: biliCheckLabel.value.includes('失效') || biliCheckLabel.value.includes('失败')
}))

const proxyTestLabel = computed(() => proxyTestText.value)
const proxyTestStateClass = computed(() => ({
  success: proxyTestState.value === 'success',
  error: proxyTestState.value === 'error'
}))

const profileTestLabel = computed(() => profileTestText.value)

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
  () => draft.downloadNotifications,
  enabled => {
    if (!enabled) return
    if (draft.notificationMode === 'both' || draft.notificationMode === 'system' || draft.notificationMode === 'in-app') return
    draft.notificationMode = 'system'
  }
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

function normalizeSettings(next: Partial<AppSettings>): AppSettings {
  return cloneSettings({
    ...draft,
    ...next
  } as AppSettings)
}

function normalizeVendor(profile: TranslateProfile): ProviderKey {
  const found = providerPresets.find(item => item.endpoint === profile.endpoint && item.model === profile.model)
  return found?.value || 'custom'
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
  }, 200)
}

async function persistSettings() {
  if (saveTimer.value) {
    clearTimeout(saveTimer.value)
    saveTimer.value = null
  }

  if (savingBusy.value) return

  savingBusy.value = true
  saveState.value = 'saving'
  try {
    const updated = await settingsStore.saveSettings(cloneSettings(draft))
    isSyncingFromStore.value = true
    Object.assign(draft, cloneSettings(updated))
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

async function loadDraft() {
  if (!settingsStore.loaded) {
    await settingsStore.loadFromLocal()
  }
  isSyncingFromStore.value = true
  Object.assign(draft, cloneSettings(settingsStore.settings))
  isSyncingFromStore.value = false
}

async function chooseDownloadPath() {
  const path = await window.api.selectSavePath()
  if (path) draft.defaultSavePath = path
}

async function chooseCookiesFile() {
  const path = await window.api.selectFilePath()
  if (path) {
    draft.cookiesFile = path
    draft.cookieMode = 'file'
  }
}

async function testProxyConnection() {
  proxyTesting.value = true
  proxyTestState.value = 'idle'
  proxyTestText.value = '测试连接中'
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

async function checkBiliStatus() {
  try {
    const [state, expired] = await Promise.all([
      window.api.getBiliState(),
      window.api.checkBiliCookies()
    ])
    biliState.value = state
    biliCheckText.value = expired ? 'Cookie 已失效' : 'Cookie 可用'
    ElMessage.success(biliCheckText.value)
  } catch (error) {
    biliCheckText.value = error instanceof Error ? error.message : '检查失败'
    ElMessage.error(biliCheckText.value)
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
    biliLoginMessage.value = '请使用 Bilibili App 扫码，并在手机上确认。'
    startBiliPolling()
  } catch (error) {
    biliLoginMessage.value = error instanceof Error ? error.message : '生成二维码失败'
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
        await checkBiliStatus()
        ElMessage.success('B 站登录成功')
      } else if (result.status === 'scanned') {
        biliLoginMessage.value = '已扫码，等待确认...'
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
    await ElMessageBox.confirm('确定清除本地保存的 B 站登录 Cookie 吗？', '清除登录', {
      type: 'warning',
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      confirmButtonClass: 'danger-light-button'
    })
  } catch {
    return
  }

  await window.api.clearBiliCookies()
  await checkBiliStatus()
  ElMessage.success('已清除登录')
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
  const preset = providerPresets[0]
  profileForm.endpoint = preset.endpoint
  profileForm.model = preset.model
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
    await ElMessageBox.confirm(`确定删除翻译方案「${profile.name || '未命名方案'}」吗？`, '删除方案', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'danger-light-button'
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
  profileTestText.value = '测试连接中'
  try {
    const key = profileForm.apiKey.trim()
    if (key) {
      const result = await window.api.testTranslateProfile({
        endpoint: profileForm.endpoint.trim(),
        model: profileForm.model.trim(),
        apiKey: key
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
      draft.activeProfileId = normalized.id
    }

    if (profileForm.apiKey.trim()) {
      await settingsStore.setApiKey(normalized.id, profileForm.apiKey.trim())
      normalized.hasKey = true
      const nextIndex = draft.translateProfiles.findIndex(item => item.id === normalized.id)
      if (nextIndex >= 0) draft.translateProfiles[nextIndex].hasKey = true
    }

    await persistSettings()
    profileDrawerVisible.value = false
    ElMessage.success('翻译方案已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存翻译方案失败')
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
      callback(new Error('Endpoint 仅支持 http 与 https'))
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
    callback(new Error('API Key 太短，请检查后再保存'))
    return
  }
  callback()
}

function formatDateTime(value?: string) {
  if (!value) return '未知'
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

onMounted(async () => {
  await loadDraft()
  await refreshMeta()
  await checkBiliStatus()
})

onBeforeUnmount(() => {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  stopBiliPolling()
})

watch(
  () => [
    settingsStore.themeMode,
    settingsStore.accentColor,
    settingsStore.density,
    settingsStore.appLanguage
  ],
  () => {
    // settings are applied by App.vue; this watch keeps the store warm for live updates
  }
)
</script>

<style scoped>
.settings-page {
  height: 100%;
  min-height: 100%;
  padding: 18px clamp(14px, 2.2vw, 24px) 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--vb-bg);
  color: var(--vb-text);
  box-sizing: border-box;
}

.settings-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}

.content-inner {
  width: 100%;
  max-width: 1240px;
  padding: 4px 0 8px;
}

.settings-section {
  padding: 0 clamp(6px, 1.6vw, 18px) 8px clamp(8px, 1.8vw, 22px);
}

.section-header {
  padding: 14px 0 8px;
}

.section-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

.section-rows {
  border-top: 1px solid var(--vb-border-light);
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(280px, 460px);
  gap: 18px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--vb-border-light);
  min-height: 60px;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-copy strong {
  font-size: 14px;
  font-weight: 500;
}

.setting-copy span {
  color: var(--vb-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.setting-control {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.control-field {
  width: 100%;
}

.choice-group {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.path-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
}

.path-input {
  flex: 1;
  min-width: 0;
}

.path-input :deep(.el-input__inner) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-row--bili {
  min-height: 94px;
}

.bili-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.bili-status__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.bili-status__grid div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bili-status__grid span {
  color: var(--vb-text-tertiary);
  font-size: 11px;
}

.bili-status__grid strong {
  font-size: 13px;
  font-weight: 500;
  word-break: break-all;
}

.bili-status__path {
  grid-column: 1 / -1;
}

.inline-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.inline-actions--left {
  justify-content: flex-start;
}

.inline-result {
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.inline-result.success,
.status-note.success {
  color: var(--vb-success);
}

.inline-result.error,
.status-note.error {
  color: var(--vb-danger);
}

.status-note {
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.translate-toolbar {
  display: flex;
  justify-content: flex-start;
  padding: 12px 0 8px;
}

.translate-list {
  border-top: 1px solid var(--vb-border-light);
  overflow-x: auto;
}

.empty-state {
  padding: 16px 0 6px;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.translate-head,
.translate-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(180px, 1fr) 120px 150px;
  gap: 12px;
  align-items: center;
  min-width: 720px;
}

.translate-head {
  padding: 12px 0;
  color: var(--vb-text-tertiary);
  font-size: 12px;
  border-bottom: 1px solid var(--vb-border-light);
}

.translate-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--vb-border-light);
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
  font-weight: 500;
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
  gap: 6px;
  flex-wrap: wrap;
}

.checkbox-group {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.qr-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.qr-dialog__canvas {
  width: 220px;
  height: 220px;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vb-border-light);
  background: var(--vb-bg-surface);
}

.qr-dialog__canvas img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder {
  color: var(--vb-text-tertiary);
  font-size: 12px;
}

.qr-dialog__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qr-dialog__meta p {
  margin: 0;
  color: var(--vb-text-secondary);
  font-size: 12px;
}

.drawer-status {
  padding: 0 24px 12px;
  color: var(--vb-text-secondary);
  font-size: 12px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suffix-toggle {
  border: 0;
  background: transparent;
  color: var(--vb-accent);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

:global(.danger-light-button) {
  color: var(--vb-danger) !important;
  border-color: rgba(239, 68, 68, 0.24) !important;
  background: rgba(239, 68, 68, 0.06) !important;
}

:global(.danger-light-button:hover) {
  background: rgba(239, 68, 68, 0.1) !important;
  border-color: rgba(239, 68, 68, 0.32) !important;
}

@media (max-width: 1120px) {
  .setting-row {
    grid-template-columns: 1fr;
  }

  .setting-control {
    justify-content: flex-start;
  }

  .choice-group,
  .inline-actions,
  .translate-actions,
  .checkbox-group {
    justify-content: flex-start;
  }

  .content-inner {
    max-width: none;
  }

  .translate-head,
  .translate-row {
    min-width: 680px;
  }
}

@media (max-width: 820px) {
  .settings-page {
    padding: 14px 12px 18px;
  }

  .settings-section {
    padding: 0 4px 8px;
  }

  .bili-status__grid {
    grid-template-columns: 1fr;
  }

  .path-control > * {
    width: 100%;
  }

  .path-control :deep(.el-button),
  .inline-actions :deep(.el-button) {
    min-width: 0;
  }

  .qr-dialog__canvas {
    width: min(220px, 100%);
    height: auto;
    aspect-ratio: 1 / 1;
  }
}

@media (max-width: 640px) {
  .translate-head,
  .translate-row {
    min-width: 620px;
  }

  .drawer-footer {
    justify-content: flex-start;
  }
}
</style>






