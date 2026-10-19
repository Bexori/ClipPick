<template>
  <div class="audio-page">
    <div class="audio-card">
      <div class="audio-card__header">
        <div>
          <div class="audio-card__eyebrow">本地媒体工具</div>
          <h2>提取音频</h2>
          <p>从本地视频或音频文件中提取音频，处理结果默认保存在原文件所在目录。</p>
        </div>
        <div class="audio-card__badge">FFmpeg</div>
      </div>

      <button type="button" class="file-picker" :disabled="processing" @click="chooseFile">
        <span class="file-picker__icon"><el-icon :size="22"><FolderOpened /></el-icon></span>
        <span class="file-picker__copy">
          <span class="file-picker__title">选择要处理的文件</span>
          <span class="file-picker__hint">支持 MP4、MKV、MOV、MP3、WAV 等常见格式</span>
        </span>
        <span class="file-picker__action">浏览文件</span>
      </button>

      <div v-if="selectedFile" class="selected-file">
        <div class="selected-file__icon"><el-icon><Document /></el-icon></div>
        <div class="selected-file__copy">
          <strong>{{ fileName(selectedFile) }}</strong>
          <span>{{ selectedFile }}</span>
        </div>
        <el-button text :disabled="processing" @click="chooseFile">更换</el-button>
      </div>

      <div class="audio-options">
        <div>
          <div class="option-label">输出格式</div>
          <div class="option-hint">选择适合你的音质和文件大小</div>
        </div>
        <el-select v-model="outputFormat" :disabled="processing || !selectedFile" style="width: 230px">
          <el-option label="MP3（通用）" value="mp3" />
          <el-option label="FLAC（无损）" value="flac" />
          <el-option label="WAV（无损）" value="wav" />
          <el-option label="AAC" value="aac" />
          <el-option label="Opus" value="opus" />
          <el-option label="M4A" value="m4a" />
        </el-select>
      </div>

      <div v-if="processing || completed || errorMessage" class="audio-status">
        <el-progress :percentage="progress" :indeterminate="processing && progress === 0" />
        <p v-if="processing">正在提取音频，请稍候...</p>
        <p v-else-if="completed" class="success-text">提取完成：{{ outputPath }}</p>
        <p v-else class="error-text">{{ errorMessage }}</p>
      </div>

      <div class="audio-actions">
        <el-button
          type="primary"
          size="large"
          :disabled="!selectedFile || processing"
          :loading="processing"
          @click="startExtract"
        >
          {{ processing ? '处理中...' : '开始提取' }}
        </el-button>
        <el-button v-if="completed && outputPath" size="large" @click="showOutput">
          打开文件位置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, FolderOpened } from '@element-plus/icons-vue'

const selectedFile = ref('')
const outputFormat = ref('mp3')
const processing = ref(false)
const progress = ref(0)
const completed = ref(false)
const outputPath = ref('')
const errorMessage = ref('')
let currentTaskId = ''
let unsubscribeProgress: (() => void) | null = null
let unsubscribeComplete: (() => void) | null = null
let unsubscribeError: (() => void) | null = null

onMounted(() => {
  unsubscribeProgress = window.api.onFfmpegProgress(data => {
    if (data.taskId === currentTaskId) progress.value = data.percentage
  })
  unsubscribeComplete = window.api.onFfmpegComplete(data => {
    if (data.taskId !== currentTaskId) return
    processing.value = false
    completed.value = true
    progress.value = 100
    outputPath.value = data.outputPath
    ElMessage.success('音频提取完成')
  })
  unsubscribeError = window.api.onFfmpegError(data => {
    if (data.taskId !== currentTaskId) return
    processing.value = false
    errorMessage.value = data.error
    ElMessage.error(data.error)
  })
})

onUnmounted(() => {
  unsubscribeProgress?.()
  unsubscribeComplete?.()
  unsubscribeError?.()
})

async function chooseFile() {
  const filepath = await window.api.selectFilePath()
  if (!filepath) return

  const resolved = await window.api.resolvePath(filepath)
  if (!resolved.ok || !resolved.resolvedPath) {
    ElMessage.warning(resolved.message || '无法读取所选文件')
    return
  }

  selectedFile.value = resolved.resolvedPath
  completed.value = false
  outputPath.value = ''
  errorMessage.value = ''
  progress.value = 0
}

async function startExtract() {
  if (!selectedFile.value || processing.value) return

  processing.value = true
  completed.value = false
  errorMessage.value = ''
  outputPath.value = ''
  progress.value = 0

  try {
    currentTaskId = await window.api.extractAudio({
      inputPath: selectedFile.value,
      outputFormat: outputFormat.value
    })
  } catch (error) {
    processing.value = false
    errorMessage.value = error instanceof Error ? error.message : '音频提取失败'
  }
}

async function showOutput() {
  if (!outputPath.value) return
  const result = await window.api.showItemInFolder(outputPath.value)
  if (!result.ok) ElMessage.warning(result.message || '无法打开文件位置')
}

function fileName(filepath: string): string {
  return filepath.split(/[\\/]/).filter(Boolean).pop() || filepath
}
</script>

<style scoped>
.audio-page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 36px clamp(18px, 5vw, 80px);
  overflow: auto;
  background: linear-gradient(145deg, var(--vb-bg) 0%, var(--vb-bg-surface) 100%);
}

.audio-card {
  width: min(780px, 100%);
  margin: 0 auto;
  padding: 32px 36px 30px;
  border: 1px solid var(--vb-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--vb-bg-surface) 94%, transparent);
  box-shadow: 0 18px 45px rgba(31, 35, 41, 0.08);
}

.audio-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.audio-card__eyebrow {
  margin-bottom: 8px;
  color: var(--vb-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.audio-card__header h2 {
  margin: 0;
  color: var(--vb-text);
  font-size: 26px;
  letter-spacing: -0.02em;
}

.audio-card__header p {
  margin: 9px 0 25px;
  color: var(--vb-text-secondary);
  font-size: 13px;
}

.audio-card__badge {
  flex-shrink: 0;
  padding: 6px 10px;
  border: 1px solid var(--vb-border);
  border-radius: 999px;
  color: var(--vb-text-tertiary);
  font-size: 11px;
  font-weight: 600;
}

.file-picker {
  width: 100%;
  min-height: 108px;
  padding: 18px 20px;
  box-sizing: border-box;
  border: 1px solid var(--vb-border);
  border-radius: 12px;
  background: var(--vb-bg);
  color: var(--vb-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.file-picker:hover:not(:disabled) {
  border-color: var(--vb-accent);
  background: var(--vb-accent-bg);
  transform: translateY(-1px);
}

.file-picker:disabled { cursor: not-allowed; opacity: 0.65; }
.file-picker__icon {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 11px;
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
}
.file-picker__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.file-picker__title { font-size: 14px; font-weight: 650; }
.file-picker__hint { color: var(--vb-text-tertiary); font-size: 12px; }
.file-picker__action { color: var(--vb-accent); font-size: 13px; font-weight: 600; }

.selected-file {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--vb-bg-hover);
}

.selected-file__icon {
  color: var(--vb-accent);
  font-size: 20px;
}

.selected-file__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.selected-file__copy strong { color: var(--vb-text); font-size: 13px; }
.selected-file__copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vb-text-tertiary); font-size: 12px; }

.audio-options { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 22px; padding: 15px 0; border-top: 1px solid var(--vb-border); border-bottom: 1px solid var(--vb-border); }
.option-label { color: var(--vb-text); font-size: 13px; font-weight: 600; }
.option-hint { margin-top: 4px; color: var(--vb-text-tertiary); font-size: 11px; }

.audio-status { margin-top: 20px; color: var(--vb-text-secondary); font-size: 13px; }
.audio-status p { margin: 8px 0 0; }
.success-text { color: var(--vb-success); word-break: break-all; }
.error-text { color: var(--vb-danger); }

.audio-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }

@media (max-width: 600px) {
  .audio-page { padding: 16px; }
  .audio-card { padding: 20px; }
  .audio-card__header { flex-direction: column; gap: 0; }
  .audio-card__badge { display: none; }
  .file-picker { align-items: flex-start; }
  .file-picker__action { display: none; }
  .audio-options { align-items: flex-start; flex-direction: column; gap: 10px; }
  .audio-options .el-select { width: 100% !important; }
  .audio-actions { flex-direction: column; }
}
</style>
