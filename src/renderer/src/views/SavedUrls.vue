<template>
  <div class="list-page">
    <div class="list-page__header">
      <div class="list-page__title-wrap">
        <h2 class="list-page__title">收藏</h2>
        <p class="list-page__desc">保存常用链接，后续可以快速回到首页重新解析、复制或移除收藏。</p>
      </div>
    </div>

    <div class="list-page__toolbar">
      <div class="list-page__summary">
        <span class="list-page__count">{{ savedUrlsStore.entries.length }}</span>
        <span class="list-page__label">条收藏</span>
      </div>
      <div class="list-page__actions">
        <el-button
          type="danger"
          plain
          :disabled="savedUrlsStore.entries.length === 0"
          @click="handleClearAll"
        >
          清空全部
        </el-button>
      </div>
    </div>

    <div v-if="!savedUrlsStore.loading && savedUrlsStore.entries.length === 0" class="list-page__empty">
      <el-icon :size="28"><Star /></el-icon>
      <strong>暂无收藏内容</strong>
      <span>在首页把链接加入收藏后，会统一显示在这里，方便后续再次解析或复制。</span>
    </div>

    <div v-else class="saved-table-wrap">
      <el-table
        :data="pagedEntries"
        v-loading="savedUrlsStore.loading"
        stripe
        :show-header="true"
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

        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip header-align="center" />
        <el-table-column prop="uploader" label="上传者" min-width="140" show-overflow-tooltip header-align="center" />
        <el-table-column prop="url" label="链接" min-width="220" show-overflow-tooltip header-align="center" />

        <el-table-column label="保存时间" width="160" header-align="center">
          <template #default="{ row }">
            <span class="meta-text">{{ formatDate(row.savedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="64" header-align="center">
          <template #default="{ row }">
            <SavedUrlActionDropdown
              :row="row"
              @open="handleOpen"
              @copy="handleCopy"
              @delete="handleDeleteByRow"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="list-page__footer" v-if="savedUrlsStore.entries.length > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="savedUrlsStore.entries.length"
        layout="total, sizes, prev, pager, next"
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
import { Star, VideoCamera } from '@element-plus/icons-vue'
import SavedUrlActionDropdown from '../components/SavedUrlActionDropdown.vue'
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

function handleDeleteByRow(entry: SavedUrlEntry) {
  return handleDelete(entry.id)
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

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

.meta-text {
  color: var(--vb-text-secondary);
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
