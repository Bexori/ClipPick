<template>
  <div class="history-page">
    <div class="history-top">
      <div>
        <h2 class="history-heading">下载历史</h2>
        <p class="history-sub">{{ historyStore.entries.length }} 条记录</p>
      </div>
      <el-button
        type="danger"
        plain
        :disabled="historyStore.entries.length === 0"
        @click="handleClear"
      >
        清空全部
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

async function handleOpenFolder(filepath: string) {
  const result = await window.api.openFileInFolder(filepath)
  if (!result.ok && result.message) {
    ElMessage.warning(result.message)
  }
}
</script>

<style scoped>
.history-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 28px;
}

.history-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.history-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--vb-text);
  margin-bottom: 4px;
}

.history-sub {
  font-size: 13px;
  color: var(--vb-text-tertiary);
}
</style>
