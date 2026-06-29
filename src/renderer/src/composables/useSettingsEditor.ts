import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settings.store'
import type { AppSettings, TranslateProfile, BiliLoginState } from '../../../shared/types'

type TabKey = 'download' | 'bilibili' | 'cookie' | 'network' | 'notify' | 'translate'

const defaultProfile: TranslateProfile = {
  id: 'deepseek',
  name: 'DeepSeek',
  endpoint: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
  hasKey: false
}

const providerPresets = [
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
  { value: 'minimax', label: 'MiniMax', endpoint: 'https://api.minimaxi.com/v1', model: 'abab6.5s-chat' },
  { value: 'moonshot', label: 'Moonshot', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { value: 'zhipu', label: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { value: 'custom', label: '自定义', endpoint: '', model: '' }
]

const cookieModeOptions = [
  { label: '自动', value: 'auto' },
  { label: '浏览器', value: 'browser' },
  { label: '文件', value: 'file' },
  { label: '关闭', value: 'none' }
]

export function useSettingsEditor() {
  const settingsStore = useSettingsStore()
  const saving = ref(false)
  const activeTab = ref<TabKey>('download')
  const version = ref('1.0.0')
  const biliDialogVisible = ref(false)
  const biliState = ref<BiliLoginState>({ loggedIn: false, expired: false })
  const profileKeyInputs = reactive<Record<string, string>>({})
  const draft = reactive<AppSettings>({ ...settingsStore.settings })

  const displaySavePath = computed(() => {
    if (draft.defaultSavePath) return draft.defaultSavePath
    if (settingsStore.defaultSavePath) return settingsStore.defaultSavePath
    return '系统下载目录（ClipPick/downloads）'
  })

  function ensureDefaults() {
    if (!draft.translateProfiles || draft.translateProfiles.length === 0) {
      draft.translateProfiles = [{ ...defaultProfile }]
      draft.activeProfileId = defaultProfile.id
    }

    if (!draft.activeProfileId || !draft.translateProfiles.some(profile => profile.id === draft.activeProfileId)) {
      draft.activeProfileId = draft.translateProfiles[0]?.id || defaultProfile.id
    }
  }

  function resetDraft() {
    Object.assign(draft, JSON.parse(JSON.stringify(settingsStore.settings)))
    ensureDefaults()
  }

  async function refreshMeta() {
    try {
      version.value = await window.api.getAppVersion()
    } catch {
      version.value = '1.0.0'
    }
    await refreshBiliState()
  }

  async function init() {
    if (!settingsStore.loaded) {
      await settingsStore.loadFromLocal()
    }
    resetDraft()
    await refreshMeta()
  }

  async function refreshBiliState() {
    try {
      biliState.value = await window.api.getBiliState()
    } catch {
      biliState.value = { loggedIn: false, expired: false }
    }
  }

  function detectProvider(profile: TranslateProfile): string {
    const match = providerPresets.find(item => item.endpoint === profile.endpoint && item.model === profile.model)
    return match?.value || 'custom'
  }

  function applyProvider(profile: TranslateProfile, value: string) {
    const preset = providerPresets.find(item => item.value === value)
    if (preset && preset.value !== 'custom') {
      profile.endpoint = preset.endpoint
      profile.model = preset.model
    }
  }

  function onKeyInput(profileId: string, value: string) {
    profileKeyInputs[profileId] = String(value ?? '')
  }

  function addProfile() {
    const id = `profile-${Date.now()}`
    draft.translateProfiles.push({
      id,
      name: '新方案',
      endpoint: defaultProfile.endpoint,
      model: defaultProfile.model,
      hasKey: false
    })
    if (!draft.activeProfileId) {
      draft.activeProfileId = id
    }
  }

  function removeProfile(index: number) {
    const profile = draft.translateProfiles[index]
    if (!profile) return

    delete profileKeyInputs[profile.id]
    draft.translateProfiles.splice(index, 1)

    if (draft.activeProfileId === profile.id) {
      draft.activeProfileId = draft.translateProfiles[0]?.id || defaultProfile.id
    }
  }

  async function selectPath() {
    const path = await window.api.selectSavePath()
    if (path) draft.defaultSavePath = path
  }

  async function handleBiliLogout() {
    await window.api.clearBiliCookies()
    biliState.value = { loggedIn: false, expired: false }
    ElMessage.success('B站登录已退出')
  }

  async function save() {
    saving.value = true
    try {
      for (const [profileId, key] of Object.entries(profileKeyInputs)) {
        if (key) {
          await settingsStore.setApiKey(profileId, key)
          delete profileKeyInputs[profileId]
        }
      }

      await settingsStore.saveSettings(JSON.parse(JSON.stringify(draft)))
      resetDraft()
      ElMessage.success('设置已保存')
    } finally {
      saving.value = false
    }
  }

  return {
    settingsStore,
    saving,
    activeTab,
    version,
    biliDialogVisible,
    biliState,
    profileKeyInputs,
    draft,
    displaySavePath,
    providerPresets,
    cookieModeOptions,
    init,
    resetDraft,
    refreshBiliState,
    detectProvider,
    applyProvider,
    onKeyInput,
    addProfile,
    removeProfile,
    selectPath,
    handleBiliLogout,
    save
  }
}
