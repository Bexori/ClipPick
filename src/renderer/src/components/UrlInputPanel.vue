<template>
  <div class="panel">
    <div class="section-title">1. 输入视频链接</div>
    <div class="input-row">
      <input
        :value="url"
        class="url-input"
        placeholder="粘贴视频链接，例如：https://www.example.com/video/xxxx"
        @input="$emit('update:url', ($event.target as HTMLInputElement).value)"
        @keyup.enter="$emit('parse')"
      />
      <button class="sub-btn" @click="$emit('paste')">
        <span>▣</span>
        粘贴
      </button>
      <button class="sub-btn" @click="$emit('clear')">
        <span>⌫</span>
        清空
      </button>
      <button
        class="primary-btn"
        :disabled="!url || parsing"
        @click="$emit('parse')"
      >
        <span v-if="parsing" class="mini-loading"></span>
        <span v-else>▷</span>
        {{ parsing ? '解析中...' : hasVideo ? '重新解析' : '解析视频' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  url: string
  parsing: boolean
  hasVideo: boolean
}>()

defineEmits<{
  'update:url': [value: string]
  parse: []
  paste: []
  clear: []
}>()
</script>

<style scoped>
.panel {
  border-radius: 14px;
  padding: 16px 18px;
  background: linear-gradient(180deg, rgba(17, 31, 59, 0.92), rgba(12, 23, 44, 0.92));
  border: 1px solid rgba(96, 125, 172, 0.26);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.section-title {
  margin-bottom: 12px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 800;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 96px 96px 140px;
  gap: 12px;
}

.url-input {
  height: 42px;
  padding: 0 14px;
  color: #f8fafc;
  font-size: 14px;
  border-radius: 9px;
  border: 1px solid rgba(104, 132, 182, 0.42);
  background: rgba(8, 17, 35, 0.72);
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.url-input:focus {
  border-color: rgba(255, 95, 167, 0.8);
  box-shadow: 0 0 0 3px rgba(255, 95, 167, 0.12);
}

.url-input::placeholder {
  color: #697893;
}

.sub-btn,
.primary-btn {
  height: 42px;
  border-radius: 9px;
  color: #e2e8f0;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sub-btn {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(100, 116, 139, 0.36);
}

.sub-btn:hover {
  background: rgba(51, 65, 85, 0.9);
}

.primary-btn {
  background: linear-gradient(135deg, #ff5fa7, #815cff);
  color: white;
  box-shadow: 0 10px 22px rgba(255, 95, 167, 0.2);
}

.primary-btn:hover {
  filter: brightness(1.06);
}

.primary-btn:disabled {
  opacity: 0.45;
  filter: grayscale(0.2);
  box-shadow: none;
}

.mini-loading {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-top-color: #ffffff;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
