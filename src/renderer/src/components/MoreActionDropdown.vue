<template>
  <el-dropdown trigger="click" :hide-on-click="false" popper-class="more-action-popper">
    <button type="button" class="more-action-trigger" @click.stop>
      <el-icon :size="16"><MoreFilled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item @click="$emit('openLocation', row)">
          <el-icon :size="14"><FolderOpened /></el-icon>
          <span>打开位置</span>
        </el-dropdown-item>
        <el-dropdown-item @click="$emit('process', row)">
          <el-icon :size="14"><Switch /></el-icon>
          <span>后期处理</span>
        </el-dropdown-item>
        <el-dropdown-item divided @click="$emit('delete', row)">
          <el-icon :size="14"><Delete /></el-icon>
          <span class="danger-text">删除</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { Delete, FolderOpened, MoreFilled, Switch } from '@element-plus/icons-vue'
import type { HistoryEntry } from '../../../shared/types'

defineProps<{
  row: HistoryEntry
}>()

defineEmits<{
  openLocation: [row: HistoryEntry]
  process: [row: HistoryEntry]
  delete: [row: HistoryEntry]
}>()
</script>

<style scoped>
.more-action-trigger {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--vb-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--vb-transition);
}
.more-action-trigger:hover {
  background: var(--vb-bg-hover);
  color: var(--vb-text);
}
.danger-text {
  color: var(--vb-danger);
}
</style>
