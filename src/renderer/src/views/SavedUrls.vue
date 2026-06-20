<template>
  <div class="saved-urls-page">
    <div class="saved-top">
      <h2 class="saved-heading">收藏</h2>
      <el-button
        type="danger"
        plain
        :disabled="savedUrlsStore.entries.length === 0"
        @click="handleClearAll"
      >
        清空全部
      </el-button>
    </div>

    <div class="saved-table-wrap">
      <el-table
        :data="pagedEntries"
        v-loading="savedUrlsStore.loading"
        stripe
        :show-header="false"
        empty-text="暂无已保存的链接"
        row-key="id"
        size="default"
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

        <el-table-column label="操作" width="240" fixed="right" header-align="center">
          <template #default="{ row }">
            <div class="action-btns">
              <el-button size="small" type="primary" @click="handleOpen(row)">解析</el-button>
              <el-button size="small" plain @click="handleCopy(row)">复制</el-button>
              <el-button size="small" plain type="danger" @click="handleDelete(row.id)">取消收藏</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="saved-pagination" v-if="savedUrlsStore.entries.length > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="savedUrlsStore.entries.length"
        layout="sizes, prev, pager, next"
        background
        small
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoCamera } from '@element-plus/icons-vue'
import { useSavedUrlsStore } from '../stores/saved-urls.store'
import type { SavedUrlEntry } from '../../../shared/types'

const router = useRouter()
const savedUrlsStore = useSavedUrlsStore()

const currentPage = ref(1)
const pageSize = ref(10)

const pagedEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return savedUrlsStore.entries.slice(start, start + pageSize.value)
})

onMounted(() => {
  savedUrlsStore.loadSavedUrls()
})

function handleOpen(entry: SavedUrlEntry) {
  router.push({ path: '/', query: { url: entry.url } })
}

async function handleCopy(entry: SavedUrlEntry) {
  try {
    await navigator.clipboard.writeText(entry.url)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定取消收藏该链接吗？', '提示', {
      type: 'warning',
      confirmButtonText: '取消收藏',
      cancelButtonText: '取消'
    })
    await savedUrlsStore.deleteEntry(id)
    const maxPage = Math.max(1, Math.ceil(savedUrlsStore.entries.length / pageSize.value))
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
    }
    ElMessage.success('已取消收藏')
  } catch {
    // cancelled
  }
}

async function handleClearAll() {
  try {
    await ElMessageBox.confirm('确定清空所有收藏吗？此操作不可撤销。', '提示', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消'
    })
    for (const entry of [...savedUrlsStore.entries]) {
      await savedUrlsStore.deleteEntry(entry.id)
    }
    currentPage.value = 1
    ElMessage.success('收藏已清空')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.saved-urls-page {
  max-width: 1140px;
  margin: 0 auto;
  padding: 20px 20px 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.saved-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.saved-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--vb-text);
  margin: 0;
}

.saved-table-wrap {
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

.action-btns {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  white-space: nowrap;
}

.saved-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 0 0;
  flex-shrink: 0;
  margin-top: auto;
}
</style>
