import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppSettings, CookieBrowser, CookieMode, TranslateProfile } from '../../../shared/types'

const fallbackSettings: AppSettings = {
  defaultSavePath: '',
  concurrentDownloads: 3,
  cookieMode: 'auto',
  cookieBrowser: 'edge',
  cookiesFile: '',
  biliCookieHours: 168,
  proxy: '',
  downloadNotifications: true,
  notificationMode: 'system',
  autoRetryCount: 1,
  appLanguage: 'system',
  themeMode: 'system',
  density: 'standard',
  accentColor: '#6c5ce7',
  translateProfiles: [],
  activeProfileId: ''
}

function sanitizeCookieBrowser(value: unknown): CookieBrowser {
  return ['edge', 'chrome', 'firefox', 'custom'].includes(String(value))
    ? (String(value) as CookieBrowser)
    : fallbackSettings.cookieBrowser
}

export const useSettingsStore = defineStore('settings', () => {
  const defaultSavePath = ref(fallbackSettings.defaultSavePath)
  const concurrentDownloads = ref(fallbackSettings.concurrentDownloads)
  const cookieMode = ref<CookieMode>(fallbackSettings.cookieMode)
  const cookieBrowser = ref<CookieBrowser>(fallbackSettings.cookieBrowser)
  const cookiesFile = ref(fallbackSettings.cookiesFile)
  const biliCookieHours = ref(fallbackSettings.biliCookieHours)
  const proxy = ref(fallbackSettings.proxy)
  const downloadNotifications = ref(fallbackSettings.downloadNotifications)
  const notificationMode = ref(fallbackSettings.notificationMode)
  const autoRetryCount = ref(fallbackSettings.autoRetryCount)
  const appLanguage = ref(fallbackSettings.appLanguage)
  const themeMode = ref(fallbackSettings.themeMode)
  const density = ref(fallbackSettings.density)
  const accentColor = ref(fallbackSettings.accentColor)
  const translateProfiles = ref<TranslateProfile[]>(fallbackSettings.translateProfiles)
  const activeProfileId = ref(fallbackSettings.activeProfileId)
  const loaded = ref(false)

  const settings = computed<AppSettings>(() => ({
    defaultSavePath: defaultSavePath.value,
    concurrentDownloads: concurrentDownloads.value,
    cookieMode: cookieMode.value,
    cookieBrowser: cookieBrowser.value,
    cookiesFile: cookiesFile.value,
    biliCookieHours: biliCookieHours.value,
    proxy: proxy.value,
    downloadNotifications: downloadNotifications.value,
    notificationMode: notificationMode.value,
    autoRetryCount: autoRetryCount.value,
    appLanguage: appLanguage.value,
    themeMode: themeMode.value,
    density: density.value,
    accentColor: accentColor.value,
    translateProfiles: translateProfiles.value,
    activeProfileId: activeProfileId.value
  }))

  async function loadFromLocal() {
    try {
      applySettings(await window.api.getSettings())
    } catch {
      applySettings(readLegacySettings())
    } finally {
      loaded.value = true
    }
  }

  async function saveSettings(patch: Partial<AppSettings> = settings.value) {
    const updated = await window.api.updateSettings(patch)
    applySettings(updated)
    return updated
  }

  async function setApiKey(profileId: string, key: string) {
    const updated = await window.api.setDeepseekKey(profileId, key)
    applySettings(updated)
  }

  function applySettings(next: Partial<AppSettings>) {
    defaultSavePath.value = next.defaultSavePath ?? fallbackSettings.defaultSavePath
    concurrentDownloads.value = next.concurrentDownloads ?? fallbackSettings.concurrentDownloads
    cookieMode.value = next.cookieMode ?? fallbackSettings.cookieMode
    cookieBrowser.value = sanitizeCookieBrowser(next.cookieBrowser)
    cookiesFile.value = next.cookiesFile ?? fallbackSettings.cookiesFile
    biliCookieHours.value = next.biliCookieHours ?? fallbackSettings.biliCookieHours
    proxy.value = next.proxy ?? fallbackSettings.proxy
    downloadNotifications.value = next.downloadNotifications ?? fallbackSettings.downloadNotifications
    notificationMode.value = next.notificationMode ?? fallbackSettings.notificationMode
    autoRetryCount.value = next.autoRetryCount ?? fallbackSettings.autoRetryCount
    appLanguage.value = next.appLanguage ?? fallbackSettings.appLanguage
    themeMode.value = next.themeMode ?? fallbackSettings.themeMode
    density.value = next.density ?? fallbackSettings.density
    accentColor.value = next.accentColor ?? fallbackSettings.accentColor
    translateProfiles.value = next.translateProfiles ?? fallbackSettings.translateProfiles
    activeProfileId.value = next.activeProfileId ?? fallbackSettings.activeProfileId
  }

  function readLegacySettings(): AppSettings {
    try {
      const saved = localStorage.getItem('videobox-settings')
      if (!saved) return { ...fallbackSettings }
      return { ...fallbackSettings, ...JSON.parse(saved) }
    } catch {
      return { ...fallbackSettings }
    }
  }

  return {
    defaultSavePath,
    concurrentDownloads,
    cookieMode,
    cookieBrowser,
    cookiesFile,
    biliCookieHours,
    proxy,
    downloadNotifications,
    notificationMode,
    autoRetryCount,
    appLanguage,
    themeMode,
    density,
    accentColor,
    translateProfiles,
    activeProfileId,
    loaded,
    settings,
    loadFromLocal,
    saveSettings,
    setApiKey,
    applySettings
  }
})
