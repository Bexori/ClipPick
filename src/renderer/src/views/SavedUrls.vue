<template>
  <div class="saved-urls-page">
    <div class="saved-top">
      <div>
        <h2 class="saved-heading">收藏</h2>
        <p class="saved-sub">{{ savedUrlsStore.entries.length }} 条记录</p>
      </div>
    </div>

    <div class="saved-table-wrap">
      <el-table
        :data="pagedEntries"
        v-loading="savedUrlsStore.loading"
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

        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip header-align="center" />

        <el-table-column label="上传者" width="120" header-align="center">
          <template #default="{ row }">
            <span class="meta-text">{{ row.uploader || '--' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="链接" min-width="180" show-overflow-tooltip header-align="center">
          <template #default="{ row }">
            <span class="url-text">{{ row.url }}</span>
          </template>
        </el-table-column>

        <el-table-column label="保存时间" width="160" header-align="center">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.savedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right" header-align="center">
          <template #default="{ row }">
            <div class="action-btns">
              <el-button size="small" type="primary" @click="handleOpen(row)">解析</el-button>
              <el-button size="small" plain @click="handleCopy(row)">复制</el-button>
              <el-button size="small" plain type="danger" @click="handleDelete(row.id)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="saved-pagination" v-if="savedUrlsStore.entries.length > 0">
      <span class="total-hint">共 {{ savedUrlsStore.entries.length }} 条</span>
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
    await ElMessageBox.confirm('确定删除该链接？', '提示', { type: 'warning' })
    await savedUrlsStore.deleteEntry(id)
    ElMessage.success('已删除')
  } catch { /* cancelled */ }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.saved-urls-page {
  max-width: 1060px;
  margin: 0 auto;
  padding: 32px 28px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.saved-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.saved-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--vb-text);
  margin: 0;
}

.saved-sub {
  font-size: 12px;
  color: var(--vb-text-tertiary);
  margin: 4px 0 0;
}

.saved-table-wrap {
  background: var(--vb-bg-surface);
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  overflow: hidden;
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

.meta-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
}

.url-text {
  font-size: 12px;
  color: var(--vb-text-tertiary);
}

.time-text {
  font-size: 13px;
  color: var(--vb-text-secondary);
}

.action-btns {
  display: flex;
  gap: 6px;
}

.saved-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  flex-shrink: 0;
  margin-top: auto;
}

.total-hint {
  font-size: 13px;
  color: var(--vb-text-tertiary);
}
</style>
