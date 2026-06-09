<template>
  <el-card shadow="never">
    <el-table
      :data="entries"
      v-loading="loading"
      style="width: 100%"
      empty-text="暂无下载记录"
      :default-sort="{ prop: 'downloadedAt', order: 'descending' }"
    >
      <el-table-column label="封面" width="100">
        <template #default="{ row }">
          <el-image
            :src="row.thumbnail"
            style="width: 80px; height: 45px; border-radius: 6px"
            fit="cover"
          >
            <template #error>
              <div class="thumb-placeholder">
                <el-icon><VideoCamera /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />

      <el-table-column prop="formatLabel" label="格式" width="100" />

      <el-table-column label="大小" width="100">
        <template #default="{ row }">
          {{ formatBytes(row.filesize) }}
        </template>
      </el-table-column>

      <el-table-column label="时间" width="170" sortable="custom">
        <template #default="{ row }">
          {{ formatDate(row.downloadedAt) }}
        </template>
      </el-table-column>

      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'completed' ? 'success' : 'danger'" size="small">
            {{ row.status === 'completed' ? '完成' : row.status === 'error' ? '失败' : '取消' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'completed'"
            size="small"
            @click="$emit('openFolder', row.filepath)"
          >
            <el-icon><FolderOpened /></el-icon>
            打开位置
          </el-button>
          <el-button
            v-if="row.status === 'completed'"
            size="small"
            @click="$emit('process', row.filepath)"
          >
            <el-icon><VideoPlay /></el-icon>
            处理
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="$emit('delete', row.id)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { FolderOpened, VideoCamera, VideoPlay } from '@element-plus/icons-vue'
import type { HistoryEntry } from '../../../shared/types'

defineProps<{
  entries: HistoryEntry[]
  loading: boolean
}>()

defineEmits<{
  delete: [id: string]
  process: [filepath: string]
  openFolder: [filepath: string]
}>()

function formatBytes(bytes: number): string {
  if (!bytes) return '--'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.thumb-placeholder {
  width: 80px;
  height: 45px;
  background: rgba(8, 17, 35, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #697893;
  border-radius: 6px;
}
</style>
