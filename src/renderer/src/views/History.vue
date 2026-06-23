<template>
  <div class="list-page">
    <div class="list-page__header">
      <div class="list-page__title-wrap">
        <h2 class="list-page__title">下载历史</h2>
        <p class="list-page__desc">查看已完成的下载记录，并执行打开位置、后处理或清理操作。</p>
      </div>
    </div>

    <div class="list-page__toolbar">
      <div class="list-page__summary">
        <span class="list-page__count">{{ historyStore.entries.length }}</span>
        <span class="list-page__label">条记录</span>
      </div>
      <div class="list-page__actions">
        <el-button
          type="danger"
          plain
          :disabled="historyStore.entries.length === 0"
          @click="handleClear"
        >
          清空全部
        </el-button>
      </div>
    </div>

    <div v-if="!historyStore.loading && historyStore.entries.length === 0" class="list-page__empty">
      <el-icon :size="28"><Clock /></el-icon>
      <strong>暂无下载历史</strong>
      <span>下载完成后的记录会显示在这里，方便继续打开位置或做后处理。</span>
    </div>

    <HistoryTable
      v-else
      :entries="pagedEntries"
      :loading="historyStore.loading"
      @open-location="handleOpenLocation"
      @process="handleFileProcess"
      @delete="handleDelete"
    />

    <div class="list-page__footer" v-if="historyStore.entries.length > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="historyStore.entries.length"
        layout="total, sizes, prev, pager, next"
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
import { computed, h, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock } from '@element-plus/icons-vue'
import { useHistoryStore } from '../stores/history.store'
import HistoryTable from '../components/HistoryTable.vue'
import PostProcessDialog from '../components/PostProcessDialog.vue'
import type { HistoryEntry } from '../../../shared/types'

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
    ElMessage.success('记录已删除，文件已保留')
    return
  }

  if (!row.filepath) {
    await historyStore.deleteEntry(row.id)
    adjustPageAfterDelete()
    ElMessage.success('记录已删除，文件路径不存在')
    return
  }

  try {
    const existsResult = await window.api.fileExists(row.filepath)
    if (!existsResult.ok) {
      await historyStore.deleteEntry(row.id)
      adjustPageAfterDelete()
      ElMessage.success('记录已删除，本地文件不存在')
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
.list-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  padding: 20px clamp(16px, 2.4vw, 28px) 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.list-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.list-page__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.list-page__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--vb-text);
}

.list-page__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vb-text-secondary);
}

.list-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 0 2px;
  flex-shrink: 0;
}

.list-page__summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.list-page__count {
  min-width: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--vb-bg-hover);
  color: var(--vb-text);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.list-page__label {
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.list-page__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.list-page__empty {
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px;
  border: 1px dashed var(--vb-border);
  border-radius: 12px;
  background: var(--vb-bg-surface);
  color: var(--vb-text-secondary);
  text-align: center;
}

.list-page__empty strong {
  color: var(--vb-text);
  font-size: 16px;
  font-weight: 600;
}

.list-page__empty span {
  max-width: 420px;
  line-height: 1.6;
  font-size: 13px;
}

.list-page__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 8px;
  padding: 6px 0 0;
  margin-top: auto;
  flex-shrink: 0;
}

@media (max-width: 700px) {
  .list-page {
    padding: 16px;
  }

  .list-page__footer {
    justify-content: flex-start;
  }
}
</style>
