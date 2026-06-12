<template>
  <div class="bili-login-dialog">
    <div v-if="status === 'idle' || status === 'refreshing'" class="bili-state">
      <p class="bili-state-label">B站扫码登录</p>
      <p class="bili-state-desc">登录后可下载高清视频及番剧资源</p>
      <el-button type="primary" :loading="status === 'refreshing'" @click="startLogin">
        获取二维码
      </el-button>
    </div>

    <div v-else-if="status === 'loading'" class="bili-qr-wrap">
      <p class="bili-hint">请使用 Bilibili 客户端扫描二维码</p>
      <el-image :src="qrUrl" class="bili-qr-img" fit="contain" />
      <div class="bili-actions">
        <el-button size="small" plain @click="$emit('close')">取消</el-button>
        <el-button size="small" @click="startLogin">刷新二维码</el-button>
      </div>
    </div>

    <div v-else-if="status === 'scanned'" class="bili-qr-wrap">
      <p class="bili-hint success">已扫码，请在手机上确认登录</p>
      <div class="bili-actions">
        <el-button size="small" plain @click="$emit('close')">取消</el-button>
      </div>
    </div>

    <div v-else-if="status === 'success'" class="bili-state">
      <p class="bili-state-label success">登录成功</p>
      <p class="bili-state-desc">{{ nickname ? `已登录为 ${nickname}` : 'B站账号已绑定' }}</p>
      <el-button size="small" @click="$emit('close')">完成</el-button>
    </div>

    <div v-else-if="status === 'expired'" class="bili-state">
      <p class="bili-state-label warn">二维码已过期</p>
      <el-button size="small" type="primary" @click="startLogin">重新获取</el-button>
    </div>

    <div v-else-if="status === 'error'" class="bili-state">
      <p class="bili-state-label error">获取失败</p>
      <p class="bili-state-desc">{{ errorMsg }}</p>
      <el-button size="small" @click="startLogin">重试</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  close: []
  loggedIn: []
}>()

type LoginStatus = 'idle' | 'refreshing' | 'loading' | 'scanned' | 'success' | 'expired' | 'error'

const status = ref<LoginStatus>('idle')
const qrUrl = ref('')
const qrcodeKey = ref('')
const nickname = ref('')
const errorMsg = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

async function startLogin() {
  stopPoll()
  status.value = 'refreshing'
  try {
    const result = await window.api.generateBiliQr()
    qrcodeKey.value = result.qrcode_key
    qrUrl.value = result.qrUrl
    status.value = 'loading'
    startPoll()
  } catch (err) {
    status.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : '无法生成二维码'
  }
}

function startPoll() {
  pollTimer = setInterval(async () => {
    try {
      const result = await window.api.pollBiliLogin(qrcodeKey.value)
      if (result.status === 'confirmed') {
        stopPoll()
        status.value = 'success'
        nickname.value = result.nickname || ''
        emit('loggedIn')
      } else if (result.status === 'scanned') {
        status.value = 'scanned'
      } else if (result.status === 'expired') {
        stopPoll()
        status.value = 'expired'
      }
    } catch {
      // keep polling
    }
  }, 2000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

defineExpose({ startLogin })
</script>

<style scoped>
.bili-login-dialog {
  padding: 4px 0;
}

.bili-state {
  text-align: center;
  padding: 20px 0;
}

.bili-state-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--vb-text);
  margin: 0 0 8px;
}
.bili-state-label.success { color: var(--vb-success); }
.bili-state-label.warn { color: var(--vb-warning); }
.bili-state-label.error { color: var(--vb-danger); }

.bili-state-desc {
  font-size: 13px;
  color: var(--vb-text-secondary);
  margin: 0 0 16px;
}

.bili-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
}

.bili-hint {
  font-size: 14px;
  color: var(--vb-text-secondary);
  margin: 0;
}
.bili-hint.success { color: var(--vb-success); }

.bili-qr-img {
  width: 180px;
  height: 180px;
  border: 1px solid var(--vb-border);
  border-radius: 10px;
}

.bili-actions {
  display: flex;
  gap: 8px;
}
</style>
