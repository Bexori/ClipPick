import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppSettings, CookieBrowser, CookieMode } from '../../../shared/types'

const fallbackSettings: AppSettings = {
  defaultSavePath: '',
  concurrentDownloads: 3,
  cookieMode: 'auto',
  cookieBrowser: 'edge',
  cookiesFile: '',
  proxy: '',
  downloadNotifications: true,
  autoRetryCount: 1
}

export const useSettingsStore = defineStore('settings', () => {
  const defaultSavePath = ref(fallbackSettings.defaultSavePath)
  const concurrentDownloads = ref(fallbackSettings.concurrentDownloads)
  const cookieMode = ref<CookieMode>(fallbackSettings.cookieMode)
  const cookieBrowser = ref<CookieBrowser>(fallbackSettings.cookieBrowser)
  const cookiesFile = ref(fallbackSettings.cookiesFile)
  const proxy = ref(fallbackSettings.proxy)
  const downloadNotifications = ref(fallbackSettings.downloadNotifications)
  const autoRetryCount = ref(fallbackSettings.autoRetryCount)
  const loaded = ref(false)

  const settings = computed<AppSettings>(() => ({
    defaultSavePath: defaultSavePath.value,
    concurrentDownloads: concurrentDownloads.value,
    cookieMode: cookieMode.value,
    cookieBrowser: cookieBrowser.value,
    cookiesFile: cookiesFile.value,
    proxy: proxy.value,
    downloadNotifications: downloadNotifications.value,
    autoRetryCount: autoRetryCount.value
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
  }

  function applySettings(next: Partial<AppSettings>) {
    defaultSavePath.value = next.defaultSavePath ?? fallbackSettings.defaultSavePath
    concurrentDownloads.value = next.concurrentDownloads ?? fallbackSettings.concurrentDownloads
    cookieMode.value = next.cookieMode ?? fallbackSettings.cookieMode
    cookieBrowser.value = next.cookieBrowser ?? fallbackSettings.cookieBrowser
    cookiesFile.value = next.cookiesFile ?? fallbackSettings.cookiesFile
    proxy.value = next.proxy ?? fallbackSettings.proxy
    downloadNotifications.value = next.downloadNotifications ?? fallbackSettings.downloadNotifications
    autoRetryCount.value = next.autoRetryCount ?? fallbackSettings.autoRetryCount
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
    proxy,
    downloadNotifications,
    autoRetryCount,
    loaded,
    settings,
    loadFromLocal,
    saveSettings,
    applySettings
  }
})
