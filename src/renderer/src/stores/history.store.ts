import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '../../../shared/types'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const loading = ref(false)

  async function loadHistory() {
    loading.value = true
    try {
      entries.value = await window.api.getHistory()
    } catch {
      entries.value = []
    }
    loading.value = false
  }

  async function addEntry(entry: HistoryEntry) {
    try {
      await window.api.addHistory(entry)
      const idx = entries.value.findIndex(e => e.filepath === entry.filepath)
      if (idx !== -1) {
        entries.value[idx] = entry
      } else {
        entries.value.unshift(entry)
      }
    } catch (e) {
      console.error('Failed to add history entry:', e)
    }
  }

  async function deleteEntry(id: string) {
    try {
      await window.api.deleteHistory(id)
      entries.value = entries.value.filter(e => e.id !== id)
    } catch (e) {
      console.error('Failed to delete history entry:', e)
    }
  }

  async function clearHistory() {
    try {
      await window.api.clearHistory()
      entries.value = []
    } catch (e) {
      console.error('Failed to clear history:', e)
    }
  }

  return { entries, loading, loadHistory, addEntry, deleteEntry, clearHistory }
})
