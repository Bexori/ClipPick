<template>
  <div class="setting-row">
    <div class="setting-copy">
      <strong>{{ title }}</strong>
      <span>{{ desc }}</span>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc: string
}>()
</script>

<style scoped>
.setting-row {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 24px;
  align-items: center;
  padding: 18px 0;
  border-bottom: 1px solid var(--vb-border-light);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-copy strong {
  color: var(--vb-text);
  font-size: 14px;
}

.setting-copy span {
  color: var(--vb-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.setting-control {
  min-width: 0;
}

@media (max-width: 680px) {
  .setting-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>
