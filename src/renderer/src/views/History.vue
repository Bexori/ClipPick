<template>
  <div class="history-page">
    <div class="history-top">
      <h2 class="history-heading">下载历史</h2>
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
      :entries="pagedEntries"
      :loading="historyStore.loading"
      :show-header="false"
      @open-location="handleOpenLocation"
      @process="handleFileProcess"
      @delete="handleDelete"
    />

    <div class="history-pagination" v-if="historyStore.entries.length > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="historyStore.entries.length"
        layout="sizes, prev, pager, next"
        background
        small
      />
    </div>

    <PostProcessDialog
      v-model:visible="processDialogVisible"
      :filepath="selectedFilepath"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useHistoryStore } from '../stores/history.store'
import HistoryTable from '../components/HistoryTable.vue'
import PostProcessDialog from '../components/PostProcessDialog.vue'
import type { HistoryEntry } from '../../shared/types'

const historyStore = useHistoryStore()

const processDialogVisible = ref(false)
const selectedFilepath = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

onMounted(() => {
  historyStore.loadHistory()
})

const pagedEntries = computed<HistoryEntry[]>(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return historyStore.entries.slice(start, start + pageSize.value)
})

async function handleOpenLocation(row: HistoryEntry) {
  if (!row.filepath) {
    ElMessage.warning('文件路径不存在，无法打开所在位置')
    return
  }
  try {
    const result = await window.api.showItemInFolder(row.filepath)
    if (!result.ok) {
      ElMessage.warning(result.message || '无法打开文件所在位置')
    }
  } catch {
    ElMessage.warning('当前环境暂不支持打开文件所在位置')
  }
}

function handleFileProcess(row: HistoryEntry) {
  if (!row.filepath) {
    ElMessage.warning('文件不存在，无法处理')
    return
  }
  selectedFilepath.value = row.filepath
  processDialogVisible.value = true
}

async function handleDelete(row: HistoryEntry) {
  const deleteFile = ref(false)
  try {
    await ElMessageBox({
      title: '删除下载记录',
      message: h('div', { class: 'history-delete-confirm' }, [
        h('p', { class: 'history-delete-confirm__description' }, '此操作将永久删除该下载记录，且不可恢复。'),
        h('label', { class: 'history-delete-confirm__option' }, [
          h('input', {
            type: 'checkbox',
            class: 'history-delete-confirm__checkbox',
            checked: deleteFile.value,
            onChange: (event: Event) => {
              deleteFile.value = (event.target as HTMLInputElement).checked
            }
          }),
          h('span', '同时删除本地文件')
        ])
      ]),
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'history-delete-message-box',
      confirmButtonClass: 'history-delete-confirm__confirm',
      cancelButtonClass: 'history-delete-confirm__cancel'
    })
  } catch {
    return
  }

  if (!deleteFile.value) {
    await historyStore.deleteEntry(row.id)
    adjustPageAfterDelete()
    ElMessage.success('记录已删除（文件已保留）')
    return
  }

  if (!row.filepath) {
    await historyStore.deleteEntry(row.id)
    adjustPageAfterDelete()
    ElMessage.success('记录已删除（文件路径不存在）')
    return
  }

  try {
    const existsResult = await window.api.fileExists(row.filepath)
    if (!existsResult.ok) {
      await historyStore.deleteEntry(row.id)
      adjustPageAfterDelete()
      ElMessage.success('记录已删除（本地文件不存在）')
      return
    }
  } catch {
    ElMessage.warning('无法检查文件状态，仅删除记录')
    await historyStore.deleteEntry(row.id)
    adjustPageAfterDelete()
    return
  }

  try {
    const deleteResult = await window.api.deleteFile(row.filepath)
    if (!deleteResult.ok) {
      ElMessage.error(deleteResult.message || '文件删除失败，请检查文件是否被占用')
      return
    }
  } catch {
    ElMessage.error('文件删除失败，请检查文件是否被占用')
    return
  }

  await historyStore.deleteEntry(row.id)
  adjustPageAfterDelete()
  ElMessage.success('文件和记录已删除')
}

function adjustPageAfterDelete() {
  const totalAfter = historyStore.entries.length
  const maxPage = Math.max(1, Math.ceil(totalAfter / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
}

async function handleClear() {
  try {
    await ElMessageBox.confirm('确定要清空所有下载历史吗？此操作不可撤销。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await historyStore.clearHistory()
    currentPage.value = 1
    ElMessage.success('历史已清空')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.history-page {
  max-width: 1140px;
  margin: 0 auto;
  padding: 20px 20px 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.history-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--vb-text);
  margin: 0;
}

.history-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 0 0;
  flex-shrink: 0;
  margin-top: auto;
}
</style>