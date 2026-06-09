<template>
  <div class="home-page">
    <el-card class="input-card" shadow="never">
      <div class="url-title">视频链接解析</div>
      <el-input
        v-model="url"
        placeholder="粘贴视频链接到此处（支持 YouTube、Bilibili、Facebook、Twitter 等 1000+ 站点）"
        size="large"
        clearable
        @keyup.enter="handleParse"
        class="url-input"
      >
        <template #append>
          <el-button
            type="primary"
            :loading="parsing"
            :disabled="!url.trim()"
            @click="handleParse"
            class="parse-btn"
          >
            {{ parsing ? "解析中..." : "解析视频" }}
          </el-button>
        </template>
      </el-input>
      <div class="support-tips">
        <el-icon class="tip-icon"><Check /></el-icon>
        支持 YouTube、Bilibili、Facebook、Twitter 等 1000+ 站点视频解析下载
      </div>
    </el-card>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      closable
      style="margin-bottom: 16px"
      @close="error = ''"
    />

    <VideoInfo v-if="videoInfo" :info="videoInfo" />

    <el-card v-if="videoInfo" class="action-card" shadow="never">
      <el-row :gutter="20">
        <el-col :span="16">
          <div class="section-label">选择格式与清晰度</div>
          <FormatSelector
            v-model="selectedFormat"
            :formats="videoInfo.formats"
          />
        </el-col>
        <el-col :span="8">
          <div class="section-label">保存到</div>
          <el-input
            :model-value="savePath"
            placeholder="选择保存目录"
            readonly
            size="large"
          >
            <template #append>
              <el-button @click="handleSelectPath">选择目录</el-button>
            </template>
          </el-input>
        </el-col>
      </el-row>

      <el-row class="download-row">
        <el-col :span="24">
          <el-button
            type="primary"
            size="large"
            class="download-btn"
            :disabled="!canDownload"
            @click="handleDownload"
          >
            <el-icon><Download /></el-icon>
            {{ downloadButtonText }}
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <DownloadList v-if="activeTasks.length > 0" :tasks="activeTasks" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Check, Download } from "@element-plus/icons-vue";
import VideoInfo from "../components/VideoInfo.vue";
import FormatSelector from "../components/FormatSelector.vue";
import DownloadList from "../components/DownloadList.vue";
import { useDownloadStore } from "../stores/download.store";
import { useSettingsStore } from "../stores/settings.store";
import { useHistoryStore } from "../stores/history.store";
import type {
  CompletePayload,
  ErrorPayload,
  ProgressPayload,
} from "../../../shared/types";

const downloadStore = useDownloadStore();
const settingsStore = useSettingsStore();
const historyStore = useHistoryStore();

const url = ref("");
const parsing = ref(false);
const error = ref("");
const selectedFormat = ref("");
const savePath = ref("");

let unsubProgress: (() => void) | null = null;
let unsubComplete: (() => void) | null = null;
let unsubError: (() => void) | null = null;

const videoInfo = computed(() => downloadStore.videoInfo);
const activeTasks = computed(() => downloadStore.activeTasks);

const canDownload = computed(
  () => Boolean(videoInfo.value && selectedFormat.value && savePath.value),
);

const downloadButtonText = computed(() => {
  if (!videoInfo.value) return "下载";
  if (!selectedFormat.value) return "请选择清晰度";
  if (!savePath.value) return "请选择保存目录";
  return "开始下载";
});

onMounted(() => {
  settingsStore.loadFromLocal();
  if (settingsStore.defaultSavePath) {
    savePath.value = settingsStore.defaultSavePath;
  }

  unsubProgress = window.api.onDownloadProgress(handleProgress);
  unsubComplete = window.api.onDownloadComplete(handleComplete);
  unsubError = window.api.onDownloadError(handleError);
});

onUnmounted(() => {
  unsubProgress?.();
  unsubComplete?.();
  unsubError?.();
});

async function handleParse() {
  if (!url.value.trim()) return;

  parsing.value = true;
  error.value = "";

  try {
    const result = await window.api.parseVideo(url.value.trim());
    downloadStore.setVideoInfo(result);

    if (result.formats.length > 0) {
      const bestFormat =
        result.formats.find((format) => {
          return format.hasVideo && format.hasAudio && format.height >= 720;
        }) ||
        result.formats.find((format) => {
          return format.hasVideo && format.hasAudio;
        }) ||
        result.formats[0];

      selectedFormat.value = bestFormat.formatId;
    }
  } catch (caughtError: unknown) {
    error.value =
      caughtError instanceof Error ? caughtError.message : "解析失败";
    downloadStore.setVideoInfo(null);
  } finally {
    parsing.value = false;
  }
}

async function handleSelectPath() {
  const result = await window.api.selectSavePath();
  if (!result) return;

  savePath.value = result;
  settingsStore.defaultSavePath = result;
}

async function handleDownload() {
  if (!videoInfo.value || !selectedFormat.value || !savePath.value) return;

  const format = videoInfo.value.formats.find((item) => {
    return item.formatId === selectedFormat.value;
  });

  const formatLabel = format
    ? `${format.height > 0 ? `${format.height}p` : "audio"} ${format.ext.toUpperCase()}`
    : selectedFormat.value;

  const taskId = await window.api.startDownload({
    url: url.value.trim(),
    formatId: selectedFormat.value,
    outputDir: savePath.value,
    filename: videoInfo.value.title,
  });

  downloadStore.addTask({
    taskId,
    videoId: videoInfo.value.id,
    title: videoInfo.value.title,
    thumbnail: videoInfo.value.thumbnail,
    url: url.value.trim(),
    formatLabel,
    outputDir: savePath.value,
    filename: videoInfo.value.title,
    status: "queued",
    progress: 0,
    speed: "",
    eta: "",
    downloadedBytes: 0,
    totalBytes: 0,
    createdAt: new Date().toISOString(),
  });

  ElMessage.success("已添加到下载队列");
}

function handleProgress(data: ProgressPayload) {
  downloadStore.updateTask(data.taskId, {
    status:
      data.status === "post-processing" ? "post-processing" : "downloading",
    progress: data.percentage,
    speed: data.speed,
    eta: data.eta,
    downloadedBytes: data.downloadedBytes,
    totalBytes: data.totalBytes,
  });
}

function handleComplete(data: CompletePayload) {
  downloadStore.updateTask(data.taskId, {
    status: "completed",
    progress: 100,
    completedAt: new Date().toISOString(),
  });

  const task = downloadStore.tasks.find((item) => item.taskId === data.taskId);
  if (task) {
    historyStore.addEntry({
      id: data.taskId,
      videoId: task.videoId,
      title: task.title,
      thumbnail: task.thumbnail,
      url: task.url,
      formatLabel: task.formatLabel,
      filepath: data.filepath,
      filesize: data.filesize,
      duration: 0,
      status: "completed",
      downloadedAt: new Date().toISOString(),
    });
  }

  ElMessage.success(`${task?.title ?? "视频"} 下载完成`);
}

function handleError(data: ErrorPayload) {
  downloadStore.updateTask(data.taskId, {
    status: "error",
    error: data.error,
  });
  ElMessage.error(data.error);
}
</script>

<style scoped>
.home-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 10px;
}

.input-card {
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.url-title {
  margin-bottom: 12px;
  color: #333;
  font-size: 16px;
  font-weight: 500;
}

.url-input {
  border-radius: 8px;
}

.parse-btn {
  padding-left: 20px;
  padding-right: 20px;
}

.support-tips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: #666;
  font-size: 13px;
}

.tip-icon {
  color: #00c48c;
  font-size: 14px;
}

.action-card {
  margin-bottom: 20px;
  padding: 20px 24px;
  border-radius: 12px;
}

.section-label {
  margin-bottom: 10px;
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.download-row {
  margin-top: 20px;
}

.download-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
}
</style>
