<template>
  <div class="history-table-wrap">
    <el-table
      :data="entries"
      v-loading="loading"
      stripe
      style="width: 100%"
      empty-text="暂无下载记录"
      :default-sort="{ prop: 'downloadedAt', order: 'descending' }"
      row-key="id"
      size="default"
      :show-header="showHeader"
    >
      <el-table-column label="封面" width="88" header-align="center">
        <template #default="{ row }">
          <el-image :src="row.thumbnail" class="thumb-img" fit="cover">
            <template #error>
              <div class="thumb-fb">
                <el-icon><VideoCamera /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" min-width="260" show-overflow-tooltip header-align="center" />

      <el-table-column label="时间" width="160" sortable="custom" header-align="center">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.downloadedAt) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="54" fixed="right" class-name="action-col" header-align="center">
        <template #default="{ row }">
          <MoreActionDropdown
            :row="row"
            @open-location="$emit('openLocation', $event)"
            @process="$emit('process', $event)"
            @delete="$emit('delete', $event)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { VideoCamera } from '@element-plus/icons-vue'
import type { HistoryEntry } from '../../../shared/types'
import MoreActionDropdown from './MoreActionDropdown.vue'

withDefaults(defineProps<{
  entries: HistoryEntry[]
  loading: boolean
  showHeader?: boolean
}>(), {
  showHeader: true
})

defineEmits<{
  openLocation: [row: HistoryEntry]
  process: [row: HistoryEntry]
  delete: [row: HistoryEntry]
}>()

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.history-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.thumb-img {
  width: 72px;
  height: 48px;
  border-radius: 6px;
}

.thumb-fb {
  width: 72px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vb-bg-hover);
  color: var(--vb-text-tertiary);
  border-radius: 6px;
}

.time-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
}

:deep(.action-col) {
  padding: 0 !important;
}
:deep(.action-col .cell) {
  display: flex;
  justify-content: center;
  padding: 0 4px !important;
}

:deep(.el-table__body td .cell) {
  font-size: 13px;
}
</style>

<style>
.history-table-wrap .el-table__fixed-right {
  box-shadow: none !important;
}
.history-table-wrap .el-table__fixed-right-patch {
  background: transparent !important;
}
.history-table-wrap .el-table__fixed-right {
  z-index: 2;
}
</style>