<template>
  <el-dropdown trigger="click" popper-class="more-action-popper">
    <button type="button" class="more-action-trigger" @click.stop>
      <el-icon :size="16"><MoreFilled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item @click="$emit('open', row)">
          <el-icon :size="14"><VideoPlay /></el-icon>
          <span>解析</span>
        </el-dropdown-item>
        <el-dropdown-item @click="$emit('copy', row)">
          <el-icon :size="14"><CopyDocument /></el-icon>
          <span>复制链接</span>
        </el-dropdown-item>
        <el-dropdown-item divided @click="$emit('delete', row)">
          <el-icon :size="14"><Delete /></el-icon>
          <span class="danger-text">取消收藏</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { CopyDocument, Delete, MoreFilled, VideoPlay } from '@element-plus/icons-vue'
import type { SavedUrlEntry } from '../../../shared/types'

defineProps<{
  row: SavedUrlEntry
}>()

defineEmits<{
  open: [row: SavedUrlEntry]
  copy: [row: SavedUrlEntry]
  delete: [row: SavedUrlEntry]
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
