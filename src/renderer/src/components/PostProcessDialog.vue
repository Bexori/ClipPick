<template>
  <el-dialog
    :model-value="visible"
    title="音视频处理"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="onVisibleChange"
  >
    <div v-if="!filepath" class="no-file">
      <p>请从历史记录中选择一个已下载的文件</p>
    </div>
    <template v-else>
      <div
        class="file-card"
        :class="{
          warning: resolvedInfo && !resolvedInfo.ok,
          recovered: resolvedInfo?.ok && resolvedInfo?.inputPath !== resolvedInfo?.resolvedPath
        }"
      >
        <div class="file-icon">
          <el-icon><FolderOpened /></el-icon>
        </div>
        <div class="file-copy">
          <strong>{{ resolvedInfo?.displayName || fileName(filepath) }}</strong>
          <span>{{ resolvedInfo?.resolvedPath || filepath }}</span>
          <em v-if="resolvedInfo?.message" :class="{ success: resolvedInfo.ok }">
            {{ resolvedInfo.message }}
          </em>
        </div>
      </div>

      <el-divider />

      <el-form label-width="80px" class="process-form">
        <el-form-item label="输出格式">
          <el-select v-model="outputFormat" style="width: 100%">
            <el-option label="MP4 (H.264)" value="mp4" />
            <el-option label="MKV" value="mkv" />
            <el-option label="WebM" value="webm" />
            <el-option label="AVI" value="avi" />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="processing" class="pp-progress">
        <el-progress :percentage="ffmpegProgress" :indeterminate="ffmpegProgress === 0" />
        <p class="pp-text">
          {{ ffmpegComplete ? '处理完成' : '正在处理...' }}
        </p>
        <p v-if="ffmpegError" class="pp-error">{{ ffmpegError }}</p>
      </div>
    </template>

    <template #footer>
      <el-button :disabled="processing" @click="handleClose">取消</el-button>
      <el-button
        type="primary"
        :disabled="!canProcess"
        :loading="processing"
        @click="handleStart"
      >
        {{ processing ? '处理中...' : '开始处理' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened } from '@element-plus/icons-vue'
import type { ResolvePathResult } from '../../../shared/types'

const props = defineProps<{
  visible: boolean
  filepath: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const outputFormat = ref('mp4')
const processing = ref(false)
const ffmpegProgress = ref(0)
const ffmpegComplete = ref(false)
const ffmpegError = ref('')
const resolvedInfo = ref<ResolvePathResult | null>(null)

let unsubProgress: (() => void) | null = null
let unsubComplete: (() => void) | null = null
let unsubError: (() => void) | null = null

const canProcess = computed(() => Boolean(resolvedInfo.value?.ok && !processing.value))

watch(() => props.visible, async (val) => {
  if (val) {
    resetState()
    resolvedInfo.value = props.filepath ? await window.api.resolvePath(props.filepath) : null
    if (resolvedInfo.value?.message) {
      if (resolvedInfo.value.ok) ElMessage.success(resolvedInfo.value.message)
      else ElMessage.warning(resolvedInfo.value.message)
    }
    unsubProgress = window.api.onFfmpegProgress(handleProgress)
    unsubComplete = window.api.onFfmpegComplete(handleComplete)
    unsubError = window.api.onFfmpegError(handleError)
  } else {
    unsubscribe()
  }
})

onUnmounted(unsubscribe)

function resetState() {
  ffmpegProgress.value = 0
  ffmpegComplete.value = false
  ffmpegError.value = ''
  processing.value = false
}

function unsubscribe() {
  unsubProgress?.()
  unsubComplete?.()
  unsubError?.()
  unsubProgress = null
  unsubComplete = null
  unsubError = null
}

function handleProgress(data: { taskId: string; percentage: number }) {
  ffmpegProgress.value = data.percentage
}

function handleComplete(data: { taskId: string; outputPath: string }) {
  processing.value = false
  ffmpegComplete.value = true
  ffmpegProgress.value = 100
  ElMessage.success(`处理完成: ${data.outputPath}`)
}

function handleError(data: { taskId: string; error: string }) {
  processing.value = false
  ffmpegError.value = data.error
  ElMessage.error(data.error)
}

async function handleStart() {
  const inputPath = resolvedInfo.value?.resolvedPath
  if (!inputPath || !resolvedInfo.value?.ok || processing.value) return

  processing.value = true
  ffmpegProgress.value = 0
  ffmpegComplete.value = false
  ffmpegError.value = ''

  try {
    await window.api.convertVideo({
      inputPath,
      outputFormat: outputFormat.value
    })
  } catch (e: any) {
    processing.value = false
    ffmpegError.value = e.message || '处理失败'
  }
}

function onVisibleChange(val: boolean) {
  emit('update:visible', val)
}

function handleClose() {
  if (!processing.value) {
    resetState()
    emit('update:visible', false)
  }
}

function fileName(filepath: string): string {
  return filepath.split(/[\\/]/).filter(Boolean).pop() || filepath
}
</script>

<style scoped>
.file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius-sm);
  background: var(--vb-bg-elevated);
}

.file-card.warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: var(--vb-warning-bg);
}

.file-card.recovered {
  border-color: rgba(16, 185, 129, 0.28);
  background: var(--vb-success-bg);
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--vb-radius-sm);
  background: #fff;
  color: var(--vb-accent);
}

.file-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.file-copy strong {
  color: var(--vb-text);
  font-size: 14px;
}

.file-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vb-text-secondary);
  font-size: 12px;
}

.file-copy em {
  color: #a16207;
  font-size: 12px;
  font-style: normal;
}

.file-copy em.success {
  color: #059669;
}

.no-file {
  text-align: center;
  color: var(--vb-text-tertiary);
  padding: 20px 0;
}

.type-switch {
  display: flex;
  background: var(--vb-bg);
  border-radius: var(--vb-radius-sm);
  padding: 3px;
}

.type-switch button {
  flex: 1;
  border: 0;
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--vb-text-secondary);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  transition: all var(--vb-transition);
}

.type-switch button.active {
  background: var(--vb-accent);
  color: #fff;
}

.process-form {
  margin-top: 18px;
}

.pp-progress {
  margin-top: 16px;
}

.pp-text {
  text-align: center;
  font-size: 13px;
  color: var(--vb-text-secondary);
  margin-top: 8px;
}

.pp-error {
  text-align: center;
  font-size: 13px;
  color: #dc2626;
  margin-top: 4px;
}
</style>
