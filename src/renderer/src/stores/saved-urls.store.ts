import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SavedUrlEntry } from '../../../shared/types'

export const useSavedUrlsStore = defineStore('savedUrls', () => {
  const entries = ref<SavedUrlEntry[]>([])
  const loading = ref(false)
  let revision = 0

  async function loadSavedUrls() {
    const requestRevision = revision
    loading.value = true
    try {
      const nextEntries = await window.api.getSavedUrls()
      if (requestRevision === revision) {
        entries.value = nextEntries
      }
    } finally {
      loading.value = false
    }
  }

  async function addEntry(entry: { url: string; title: string; thumbnail: string; uploader: string }) {
    revision += 1
    const saved = await window.api.addSavedUrl(entry)
    entries.value = [saved, ...entries.value.filter(item => item.id !== saved.id && item.url !== saved.url)]
    return saved
  }

  async function deleteEntry(id: string) {
    revision += 1
    const previous = [...entries.value]
    entries.value = entries.value.filter(e => e.id !== id)
    try {
      await window.api.deleteSavedUrl(id)
    } catch (err) {
      entries.value = previous
      throw err
    }
  }

  async function removeByUrl(url: string) {
    revision += 1
    const normalizedUrl = url.trim()
    const previous = [...entries.value]
    entries.value = entries.value.filter(entry => entry.url !== normalizedUrl)
    try {
      const removed = await window.api.deleteSavedUrlByUrl(normalizedUrl)
      if (!removed) {
        entries.value = previous
      }
      return removed
    } catch (err) {
      entries.value = previous
      throw err
    }
  }

  return {
    entries,
    loading,
    loadSavedUrls,
    addEntry,
    deleteEntry,
    removeByUrl
  }
})
