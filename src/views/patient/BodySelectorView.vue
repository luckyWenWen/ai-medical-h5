<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import BodyHumanMap from '@/components/BodyHumanMap.vue'
import BodyPartGrid from '@/components/BodyPartGrid.vue'
import { useConsultationStore } from '@/stores/consultation'

const router = useRouter()
const store = useConsultationStore()
const activeTab = ref<'part' | 'symptom'>('part')
const selectedCodes = ref<string[]>([])
const submitting = ref(false)

const question = computed(() => store.currentQuestion)
console.log("8888",store.currentQuestion)
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
    <div class="body-tabs">
      <button type="button" :class="{ active: activeTab === 'part' }" @click="activeTab = 'part'">
        按部位选择
      </button>
      <button type="button" :class="{ active: activeTab === 'symptom' }" @click="activeTab = 'symptom'">
        按症状选择
      </button>
    </div>

    <main class="body-selector" :class="`body-selector--${activeTab}`">
      <BodyHumanMap
        v-if="activeTab === 'part'"
        :options="options"
        :selected-codes="selectedCodes"
        :max-selections="maxSelections"
        @toggle="toggle"
      />

      <template v-else>
        <section class="surface body-selector__intro">
          <span class="body-selector__eyebrow">不适定位</span>
          <h1>{{ question?.title || '请选择不适部位' }}</h1>
          <p>可选择多个部位，最多 {{ maxSelections }} 个。选择结果将用于后续专科问题，不代表诊断。</p>
        </section>

        <BodyPartGrid
          class="body-selector__grid-panel"
          :options="options"
          :selected-codes="selectedCodes"
          :max-selections="maxSelections"
          @toggle="toggle"
        />
      </template>
    </main>

    <div class="fixed-action body-selector-action">
      <div class="fixed-action__inner action-row">
        <van-button plain type="primary" :disabled="submitting" @click="router.back()">
          返回
        </van-button>
        <van-button type="primary" :loading="submitting" @click="confirm">
          确定（{{ selectedCodes.length }}）
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body-selector {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 12px 8px calc(92px + env(safe-area-inset-bottom));
}

.body-selector--part {
  padding-top: 0;
}

.body-tabs {
  position: sticky;
  top: calc(50px + env(safe-area-inset-top));
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 520px);
  height: 44px;
  margin: 0 auto;
  border-bottom: 1px solid #eef2f6;
  background: #fff;
}

.body-tabs button {
  position: relative;
  border: 0;
  background: transparent;
  color: #8a96a8;
  font-size: 16px;
  font-weight: 700;
}

.body-tabs button.active {
  color: #111827;
}

.body-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  content: "";
  background: #111827;
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
  color: var(--theme-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.body-selector__grid-panel {
  margin-top: 12px;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.body-selector-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  margin-top: 0;
  border-top: 1px solid var(--theme-border);
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
}
</style>
