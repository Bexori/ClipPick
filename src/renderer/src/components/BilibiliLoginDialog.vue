<template>
  <div class="bili-login-dialog">
    <div v-if="isLoggedIn && !isExpired" class="state-card">
      <div class="state-main">
        <strong>已登录</strong>
        <span>{{ accountName }}</span>
      </div>
      <div class="state-meta">
        <span>失效：{{ expiresAtLabel }}</span>
        <span>剩余：{{ expiresInLabel }}</span>
      </div>
      <div class="state-actions">
        <el-button plain type="danger" @click="handleLogout">退出登录</el-button>
        <el-button type="primary" @click="startLogin">重新登录</el-button>
      </div>
    </div>

    <div v-else-if="loginMode !== 'error'" class="qr-card">
      <div class="qr-head">
        <strong>扫码登录</strong>
        <span>{{ qrStateLabel }}</span>
      </div>

      <div class="qr-body">
        <el-image v-if="qrImage" :src="qrImage" class="qr-image" fit="contain" />
        <p class="qr-tip">使用 Bilibili App 扫描二维码，并在手机上确认登录。</p>
        <div class="qr-actions">
          <el-button plain @click="emit('close')">关闭</el-button>
          <el-button @click="startLogin">{{ isExpired ? '刷新二维码' : '重新获取' }}</el-button>
        </div>
      </div>
    </div>

    <div v-else class="error-card">
      <span>{{ errorMsg }}</span>
      <el-button size="small" type="primary" @click="startLogin">重试</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import type { BiliLoginState } from '../../../shared/types'

const emit = defineEmits<{
  close: []
  loggedIn: []
}>()

type LoginMode = 'checking' | 'refreshing' | 'qr' | 'scanned' | 'success' | 'expired' | 'error'

const loginMode = ref<LoginMode>('checking')
const accountState = ref<BiliLoginState>({ loggedIn: false, expired: true })
const qrImage = ref('')
const qrcodeKey = ref('')
const errorMsg = ref('')
const tick = ref(Date.now())
let pollTimer: ReturnType<typeof setInterval> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null

const isLoggedIn = computed(() => accountState.value.loggedIn)
const isExpired = computed(() => accountState.value.expired)
const accountName = computed(() => accountState.value.nickname || 'B 站账号')
const expiresAtLabel = computed(() => formatExpiresAt(accountState.value.expiresAt))
const expiresInLabel = computed(() => formatRemaining(accountState.value.expiresAt, tick.value))
const qrStateLabel = computed(() => {
  if (loginMode.value === 'checking') return '检查中'
  if (loginMode.value === 'refreshing') return '生成中'
  if (loginMode.value === 'qr') return '待扫描'
  if (loginMode.value === 'scanned') return '待确认'
  if (loginMode.value === 'success') return '已完成'
  if (loginMode.value === 'expired') return '已过期'
  return '进行中'
})

async function refreshState() {
  try {
    accountState.value = await window.api.getBiliState()
  } catch {
    accountState.value = { loggedIn: false, expired: true }
  }
}

async function startLogin() {
  stopPoll()
  qrImage.value = ''
  errorMsg.value = ''
  loginMode.value = 'refreshing'

  try {
    const result = await window.api.generateBiliQr()
    qrcodeKey.value = result.qrcode_key
    qrImage.value = await QRCode.toDataURL(result.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220
    })
    loginMode.value = 'qr'
    startPoll()
  } catch (err) {
    loginMode.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : '无法生成二维码'
  }
}

function startPoll() {
  pollTimer = setInterval(async () => {
    try {
      const result = await window.api.pollBiliLogin(qrcodeKey.value)
      if (result.status === 'confirmed') {
        stopPoll()
        loginMode.value = 'success'
        await refreshState()
        emit('loggedIn')
      } else if (result.status === 'scanned') {
        loginMode.value = 'scanned'
      } else if (result.status === 'expired') {
        stopPoll()
        loginMode.value = 'expired'
      }
    } catch {
      // keep polling
    }
  }, 2000)
}

async function handleLogout() {
  stopPoll()
  await window.api.clearBiliCookies()
  accountState.value = { loggedIn: false, expired: true }
  loginMode.value = 'checking'
  qrImage.value = ''
  qrcodeKey.value = ''
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function formatExpiresAt(expiresAt?: string): string {
  if (!expiresAt) return '未知'
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatRemaining(expiresAt?: string, nowMs = Date.now()): string {
  if (!expiresAt) return '未知'
  const target = new Date(expiresAt).getTime()
  if (!Number.isFinite(target)) return '未知'
  const diff = target - nowMs
  if (diff <= 0) return '已失效'

  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)

  if (hours >= 24) return `${Math.floor(hours / 24)} 天`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return `${minutes} 分钟`
  return '小于 1 分钟'
}

onMounted(async () => {
  await refreshState()
  tickTimer = setInterval(() => {
    tick.value = Date.now()
  }, 60_000)

  if (!accountState.value.loggedIn || accountState.value.expired) {
    await startLogin()
  } else {
    loginMode.value = 'checking'
  }
})

onBeforeUnmount(() => {
  stopPoll()
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})

defineExpose({ startLogin, handleLogout })
</script>

<style scoped>
.bili-login-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.state-card,
.qr-card,
.error-card {
  border: 1px solid var(--vb-border);
  border-radius: var(--vb-radius);
  background: var(--vb-bg-surface);
  padding: 14px;
}

.state-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.state-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.state-main strong,
.qr-head strong {
  font-size: 15px;
  color: var(--vb-text);
}

.state-main span,
.state-meta,
.qr-side p,
.error-card span {
  color: var(--vb-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.state-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.state-actions,
.qr-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.qr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.qr-head span {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--vb-accent-bg);
  color: var(--vb-accent);
  font-size: 12px;
  font-weight: 600;
}

.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-image {
  width: 220px;
  height: 220px;
  border: 1px solid var(--vb-border);
  border-radius: 14px;
  background: #fff;
}

.qr-tip {
  margin: 0;
  color: var(--vb-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.error-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 640px) {
  .qr-image {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .error-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
