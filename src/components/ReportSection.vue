<script setup lang="ts">
defineProps<{
  title: string
  content?: string
}>()
</script>

<template>
  <section class="report-section">
    <h2>{{ title }}</h2>
    <p>{{ content || '未填写' }}</p>
  </section>
</template>

<style scoped>
.report-section {
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  padding: 13px 14px;
  margin-bottom: 10px;
}

h2 {
  margin: 0 0 8px;
  font-size: 15px;
}

p {
  margin: 0;
  color: var(--theme-text);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
