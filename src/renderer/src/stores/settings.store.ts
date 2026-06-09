import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const defaultSavePath = ref('')
  const concurrentDownloads = ref(3)

  function loadFromLocal() {
    try {
      const saved = localStorage.getItem('videobox-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        defaultSavePath.value = parsed.defaultSavePath ?? ''
        concurrentDownloads.value = parsed.concurrentDownloads ?? 3
      }
    } catch { /* ignore */ }
  }

  function saveToLocal() {
    localStorage.setItem('videobox-settings', JSON.stringify({
      defaultSavePath: defaultSavePath.value,
      concurrentDownloads: concurrentDownloads.value
    }))
  }

  watch([defaultSavePath, concurrentDownloads], saveToLocal, { deep: true })

  return { defaultSavePath, concurrentDownloads, loadFromLocal, saveToLocal }
})
