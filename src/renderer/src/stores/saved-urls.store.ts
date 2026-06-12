import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SavedUrlEntry } from '../../../shared/types'

export const useSavedUrlsStore = defineStore('savedUrls', () => {
  const entries = ref<SavedUrlEntry[]>([])
  const loading = ref(false)

  async function loadSavedUrls() {
    loading.value = true
    try {
      entries.value = await window.api.getSavedUrls()
    } finally {
      loading.value = false
    }
  }

  async function addEntry(entry: { url: string; title: string; thumbnail: string; uploader: string }) {
    const saved = await window.api.addSavedUrl(entry)
    entries.value.unshift(saved)
    return saved
  }

  async function deleteEntry(id: string) {
    await window.api.deleteSavedUrl(id)
    entries.value = entries.value.filter(e => e.id !== id)
  }

  return {
    entries,
    loading,
    loadSavedUrls,
    addEntry,
    deleteEntry
  }
})
