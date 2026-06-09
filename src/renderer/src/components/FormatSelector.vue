<template>
  <el-select
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    placeholder="选择清晰度和格式"
    style="width: 100%"
    size="large"
  >
    <el-option-group label="推荐">
      <el-option
        v-for="format in recommendedFormats"
        :key="format.formatId"
        :label="formatLabel(format)"
        :value="format.formatId"
      />
    </el-option-group>
    <el-option-group label="仅音频">
      <el-option
        v-for="format in audioFormats"
        :key="format.formatId"
        :label="formatLabel(format)"
        :value="format.formatId"
      />
    </el-option-group>
    <el-option-group label="全部格式">
      <el-option
        v-for="format in otherFormats"
        :key="format.formatId"
        :label="formatLabel(format)"
        :value="format.formatId"
      />
    </el-option-group>
  </el-select>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { VideoFormat } from "../../../shared/types";

const props = defineProps<{
  formats: VideoFormat[];
  modelValue: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

const recommendedFormats = computed(() => {
  return props.formats.filter((format) => {
    return format.hasVideo && format.hasAudio && format.height >= 360;
  });
});

const audioFormats = computed(() => {
  return props.formats.filter((format) => {
    return !format.hasVideo && format.hasAudio;
  });
});

const otherFormats = computed(() => {
  return props.formats.filter((format) => {
    return (
      !recommendedFormats.value.includes(format) &&
      !audioFormats.value.includes(format)
    );
  });
});

function formatLabel(format: VideoFormat): string {
  const parts: string[] = [];

  if (format.height > 0) {
    parts.push(`${format.height}p`);
    if (format.fps >= 50) {
      parts.push(`${format.fps}fps`);
    }
  } else {
    parts.push(format.ext.toUpperCase());
  }

  parts.push(format.ext.toUpperCase());

  if (format.filesizeText && format.filesizeText !== "未知大小") {
    parts.push(`~${format.filesizeText}`);
  }

  if (format.note) {
    parts.push(format.note);
  }

  return parts.join("  ");
}
</script>
