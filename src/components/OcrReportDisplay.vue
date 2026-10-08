<script setup lang="ts">
import { computed } from 'vue'
import { getOcrDisplay } from '@/utils/ocrReport'

const props = defineProps<{ ocrText: string }>()
const display = computed(() => getOcrDisplay(props.ocrText))
</script>

<template>
  <div class="ocr-display">
    <h3 v-if="display.title">{{ display.title }}</h3>

    <div v-if="display.meta.length" class="ocr-meta-grid">
      <div
        v-for="meta in display.meta"
        :key="`${meta.label}-${meta.value}`"
        class="ocr-meta-item"
      >
        <span>{{ meta.label }}</span>
        <strong>{{ meta.value }}</strong>
      </div>
    </div>

    <div v-if="display.rows.length" class="ocr-results">
      <div class="ocr-results__summary">
        <strong>检验项目</strong>
        <span>共 {{ display.rows.length }} 项</span>
        <van-tag
          v-if="display.rows.some((row) => row.abnormal)"
          type="warning"
          plain
        >
          原文标记异常 {{ display.rows.filter((row) => row.abnormal).length }} 项
        </van-tag>
      </div>
      <div class="ocr-result-list" role="table" aria-label="检验结果">
        <div class="ocr-result-list__header" role="row">
          <span role="columnheader">项目</span>
          <span role="columnheader">结果 / 单位</span>
          <span role="columnheader">参考值</span>
        </div>
        <div
          v-for="row in display.rows"
          :key="`${row.seq}-${row.code}-${row.name}`"
          class="ocr-result-row"
          :class="{ 'ocr-result-row--abnormal': row.abnormal }"
          role="row"
        >
          <div class="ocr-result-row__name" role="cell">
            <strong>{{ row.name }}</strong>
            <span>{{ row.seq }} {{ row.code }}</span>
          </div>
          <div class="ocr-result-row__value" role="cell">
            <strong>{{ row.result }}</strong>
            <span v-if="row.unit">{{ row.unit }}</span>
          </div>
          <div class="ocr-result-row__reference" role="cell">
            {{ row.reference || '—' }}
          </div>
        </div>
      </div>
    </div>

    <details v-if="display.rows.length || display.meta.length" class="ocr-source">
      <summary>识别原文</summary>
      <pre>{{ ocrText }}</pre>
    </details>
    <pre v-else class="ocr-source-text">{{ ocrText }}</pre>
  </div>
</template>

<style scoped>
.ocr-display {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.ocr-display h3 {
  margin: 0;
  color: #17233c;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.ocr-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 10px 0;
  border-bottom: 1px solid #eef2f7;
}

.ocr-meta-item {
  min-width: 0;
}

.ocr-meta-item span,
.ocr-result-list__header {
  color: #7b8ca5;
  font-size: 11px;
  line-height: 1.35;
}

.ocr-meta-item strong {
  display: block;
  overflow-wrap: anywhere;
  margin-top: 3px;
  color: #1a2b45;
  font-size: 12px;
  line-height: 1.4;
}

.ocr-results__summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-bottom: 10px;
  color: #607084;
  font-size: 12px;
}

.ocr-results__summary strong {
  color: #1a2b45;
  font-size: 13px;
}

.ocr-result-list {
  background: #fff;
}

.ocr-result-list__header,
.ocr-result-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.ocr-result-list__header {
  background: #f5f8fc;
  padding: 7px 8px;
  font-weight: 600;
}

.ocr-result-row {
  padding: 9px 8px;
  border-top: 1px solid #eef2f7;
}

.ocr-result-row--abnormal {
  background: #fff8f0;
}

.ocr-result-row__name,
.ocr-result-row__value {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.ocr-result-row__name strong,
.ocr-result-row__value strong {
  overflow-wrap: anywhere;
  color: #17233c;
  font-size: 12px;
  line-height: 1.35;
}

.ocr-result-row__value,
.ocr-result-row__reference {
  font-variant-numeric: tabular-nums;
}

.ocr-result-row--abnormal .ocr-result-row__value strong {
  color: #d46b08;
}

.ocr-result-row__name span,
.ocr-result-row__value span {
  overflow-wrap: anywhere;
  color: #7b8ca5;
  font-size: 11px;
  line-height: 1.25;
}

.ocr-result-row__reference {
  overflow-wrap: anywhere;
  color: #5d6f86;
  font-size: 12px;
  line-height: 1.35;
}

.ocr-source {
  border-top: 1px solid #eef2f7;
  padding-top: 10px;
}

.ocr-source summary {
  cursor: pointer;
  color: var(--van-primary-color);
  font-size: 12px;
}

.ocr-source pre,
.ocr-source-text {
  max-height: 360px;
  overflow: auto;
  margin: 10px 0 0;
  color: #17233c;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 360px) {
  .ocr-meta-grid {
    grid-template-columns: 1fr;
  }

  .ocr-result-list__header,
  .ocr-result-row {
    gap: 6px;
  }
}

</style>
