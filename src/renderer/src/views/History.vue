<template>
  <div class="history-page">
    <div class="history-header">
      <h3>下载历史</h3>
      <el-button
        type="danger"
        plain
        :disabled="historyStore.entries.length === 0"
        @click="handleClear"
      >
        清空历史
      </el-button>
    </div>

    <HistoryTable
      :entries="historyStore.entries"
      :loading="historyStore.loading"
      @delete="handleDelete"
      @process="showProcessDialog"
      @open-folder="handleOpenFolder"
    />

    <PostProcessDialog
      v-model:visible="processDialogVisible"
      :filepath="selectedFilepath"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useHistoryStore } from '../stores/history.store'
import HistoryTable from '../components/HistoryTable.vue'
import PostProcessDialog from '../components/PostProcessDialog.vue'

const historyStore = useHistoryStore()

const processDialogVisible = ref(false)
const selectedFilepath = ref('')

onMounted(() => {
  historyStore.loadHistory()
})

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await historyStore.deleteEntry(id)
    ElMessage.success('已删除')
  } catch { /* canceled */ }
}

async function handleClear() {
  try {
    await ElMessageBox.confirm('确定要清空所有下载历史吗？此操作不可撤销。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await historyStore.clearHistory()
    ElMessage.success('历史已清空')
  } catch { /* canceled */ }
}

function showProcessDialog(filepath: string) {
  selectedFilepath.value = filepath
  processDialogVisible.value = true
}

function handleOpenFolder(filepath: string) {
  window.api.openFileInFolder(filepath)
}
</script>

<style scoped>
.history-page {
  max-width: 1100px;
  margin: 0 auto;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.history-header h3 {
  font-size: 18px;
  font-weight: 600;
}
</style>
