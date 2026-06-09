<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="onVisibleChange"
    title="音视频处理"
    width="480px"
    :close-on-click-modal="false"
  >
    <div v-if="!filepath" class="no-file">
      <p>请从历史记录中选择一个已下载的文件</p>
    </div>
    <template v-else>
      <div class="file-info">
        <el-icon><FolderOpened /></el-icon>
        <span class="file-path">{{ filepath }}</span>
      </div>

      <el-divider />

      <el-radio-group v-model="processType" style="margin-bottom: 16px">
        <el-radio value="convert">格式转换</el-radio>
        <el-radio value="extract-audio">提取音频</el-radio>
      </el-radio-group>

      <el-form label-width="80px">
        <el-form-item label="输出格式">
          <el-select v-model="outputFormat" style="width: 100%">
            <template v-if="processType === 'convert'">
              <el-option label="MP4 (H.264)" value="mp4" />
              <el-option label="MKV" value="mkv" />
              <el-option label="WebM" value="webm" />
              <el-option label="AVI" value="avi" />
            </template>
            <template v-else>
              <el-option label="MP3 (320kbps)" value="mp3" />
              <el-option label="AAC" value="aac" />
              <el-option label="FLAC (无损)" value="flac" />
              <el-option label="WAV" value="wav" />
              <el-option label="Opus" value="opus" />
              <el-option label="M4A" value="m4a" />
            </template>
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="processing" class="process-progress">
        <el-progress :percentage="ffmpegProgress" :indeterminate="ffmpegProgress === 0" />
        <p class="progress-text">
          {{ ffmpegComplete ? '处理完成!' : '正在处理...' }}
        </p>
        <p v-if="ffmpegError" class="error-text">{{ ffmpegError }}</p>
      </div>
    </template>

    <template #footer>
      <el-button @click="handleClose" :disabled="processing">取消</el-button>
      <el-button
        type="primary"
        @click="handleStart"
        :disabled="!filepath || processing"
        :loading="processing"
      >
        {{ processing ? '处理中...' : '开始处理' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened } from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
  filepath: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const processType = ref<'convert' | 'extract-audio'>('convert')
const outputFormat = ref('mp4')
const processing = ref(false)
const ffmpegProgress = ref(0)
const ffmpegComplete = ref(false)
const ffmpegError = ref('')

let unsubProgress: (() => void) | null = null
let unsubComplete: (() => void) | null = null
let unsubError: (() => void) | null = null

watch(processType, (val) => {
  outputFormat.value = val === 'convert' ? 'mp4' : 'mp3'
})

watch(() => props.visible, (val) => {
  if (val) {
    ffmpegProgress.value = 0
    ffmpegComplete.value = false
    ffmpegError.value = ''
    processing.value = false
    unsubProgress = window.api.onFfmpegProgress(handleProgress)
    unsubComplete = window.api.onFfmpegComplete(handleComplete)
    unsubError = window.api.onFfmpegError(handleError)
  } else {
    unsubProgress?.()
    unsubComplete?.()
    unsubError?.()
  }
})

onUnmounted(() => {
  unsubProgress?.()
  unsubComplete?.()
  unsubError?.()
})

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
  if (!props.filepath || processing.value) return

  processing.value = true
  ffmpegProgress.value = 0
  ffmpegComplete.value = false
  ffmpegError.value = ''

  try {
    if (processType.value === 'convert') {
      await window.api.convertVideo({
        inputPath: props.filepath,
        outputFormat: outputFormat.value
      })
    } else {
      await window.api.extractAudio({
        inputPath: props.filepath,
        outputFormat: outputFormat.value
      })
    }
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
    ffmpegComplete.value = false
    ffmpegError.value = ''
    emit('update:visible', false)
  }
}
</script>

<style scoped>
.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-file {
  text-align: center;
  color: #909399;
  padding: 20px 0;
}

.process-progress {
  margin-top: 16px;
}

.progress-text {
  text-align: center;
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

.error-text {
  text-align: center;
  font-size: 13px;
  color: #f56c6c;
  margin-top: 4px;
}
</style>
