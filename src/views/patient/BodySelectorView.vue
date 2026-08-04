<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'

const router = useRouter()
const store = useConsultationStore()
const selectedCodes = ref<string[]>([])
const submitting = ref(false)

const question = computed(() => store.currentQuestion)
const options = computed(() => question.value?.options || [])
const maxSelections = computed(() => question.value?.maxSelections || 5)

onMounted(() => {
  if (question.value?.type !== 'bodyPart') {
    router.replace('/consultation')
  }
})

function toggle(code: string) {
  if (selectedCodes.value.includes(code)) {
    selectedCodes.value = selectedCodes.value.filter((item) => item !== code)
    return
  }

  if (selectedCodes.value.length >= maxSelections.value) {
    showToast(`最多选择 ${maxSelections.value} 个部位`)
    return
  }
  selectedCodes.value = [...selectedCodes.value, code]
}

async function continueFlow(answer: string[] | null) {
  if (submitting.value) return
  submitting.value = true
  try {
    await store.answerCurrent(answer)
    if (!store.currentQuestion) {
      const reportReady = await store.buildReport()
      if (!reportReady) return
      await router.replace('/report')
      return
    }
    await router.replace('/consultation')
  } finally {
    submitting.value = false
  }
}

async function confirm() {
  if (!selectedCodes.value.length) {
    showToast('请选择不适部位')
    return
  }
  await continueFlow(selectedCodes.value)
}
</script>

<template>
  <div class="page">
    <AppNavBar title="部位选择" back />
    <main class="page-body body-selector">
      <section class="surface body-selector__intro">
        <span class="body-selector__eyebrow">不适定位</span>
        <h1>{{ question?.title || '请选择不适部位' }}</h1>
        <p>可选择多个部位，最多 {{ maxSelections }} 个。选择结果将用于后续专科问题，不代表诊断。</p>
      </section>

      <section v-if="options.length" class="surface body-selector__panel">
        <div class="body-selector__status">
          <span>已选择 {{ selectedCodes.length }} 个</span>
          <span>上限 {{ maxSelections }} 个</span>
        </div>
        <div class="body-selector__grid">
          <button
            v-for="(option, index) in options"
            :key="option.value"
            type="button"
            class="body-selector__part"
            :class="{ 'body-selector__part--active': selectedCodes.includes(option.value) }"
            :aria-pressed="selectedCodes.includes(option.value)"
            @click="toggle(option.value)"
          >
            <span class="body-selector__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ option.label }}</span>
            <van-icon
              v-if="selectedCodes.includes(option.value)"
              name="success"
              class="body-selector__check"
            />
          </button>
        </div>
      </section>

      <van-empty v-else description="当前问题未配置可选部位" />
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner action-row">
        <van-button plain type="primary" :loading="submitting" @click="continueFlow(null)">
          不清楚
        </van-button>
        <van-button type="primary" :loading="submitting" @click="confirm">确定</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body-selector {
  padding-bottom: 110px;
}

.body-selector__intro {
  position: relative;
  overflow: hidden;
  padding: 10px;
  background:
    radial-gradient(circle at 92% 12%, var(--theme-primary-soft) 0 74px, transparent 75px),
    var(--theme-surface);
}

.body-selector__eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.body-selector__intro h1 {
  margin: 0;
  color: var(--theme-text);
  font-size: 20px;
  line-height: 1.45;
}

.body-selector__intro p {
  margin: 10px 0 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.body-selector__panel {
  margin-top: 12px;
  padding: 14px;
}

.body-selector__status {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.body-selector__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.body-selector__part {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 52px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  background: var(--theme-surface);
  padding: 9px 10px;
  color: var(--theme-text);
  text-align: left;
}

.body-selector__part--active {
  border-color: var(--theme-primary);
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
}

.body-selector__index {
  margin-right: 8px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.body-selector__check {
  margin-left: 6px;
  color: var(--theme-primary);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
