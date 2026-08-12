<script setup lang="ts">
import type { QuestionOption } from '@/types/consultation'

defineProps<{
  options: QuestionOption[]
  selectedCodes: string[]
  maxSelections: number
}>()

const emit = defineEmits<{
  toggle: [code: string]
}>()
</script>

<template>
  <section v-if="options.length" class="body-part-grid surface">
    <div class="body-part-grid__status">
      <span>已选择 {{ selectedCodes.length }} 个</span>
      <span>上限 {{ maxSelections }} 个</span>
    </div>
    <div class="body-part-grid__list">
      <button
        v-for="(option, index) in options"
        :key="option.value"
        type="button"
        class="body-part-grid__item"
        :class="{ 'body-part-grid__item--active': selectedCodes.includes(option.value) }"
        :aria-pressed="selectedCodes.includes(option.value)"
        @click="emit('toggle', option.value)"
      >
        <span class="body-part-grid__index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span>{{ option.label }}</span>
        <van-icon v-if="selectedCodes.includes(option.value)" name="success" />
      </button>
    </div>
  </section>

  <van-empty v-else description="当前问题未配置可选部位" />
</template>

<style scoped>
.body-part-grid {
  padding: 14px;
}

.body-part-grid__status {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.body-part-grid__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.body-part-grid__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 46px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  background: var(--theme-surface);
  padding: 8px 9px;
  color: var(--theme-text);
  text-align: left;
}

.body-part-grid__item--active {
  border-color: var(--theme-primary);
  background: #eef6ff;
  color: var(--theme-primary);
  font-weight: 700;
}

.body-part-grid__index {
  margin-right: 8px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.body-part-grid__item .van-icon {
  margin-left: 6px;
  color: var(--theme-primary);
}
</style>
