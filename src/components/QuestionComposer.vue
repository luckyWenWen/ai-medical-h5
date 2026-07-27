<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { showToast } from 'vant'
import type { AnswerValue, ConsultationQuestion } from '@/types/consultation'

const props = defineProps<{
  question?: ConsultationQuestion
}>()

const emit = defineEmits<{
  submit: [answer: AnswerValue]
  upload: []
}>()

const singleValue = ref('')
const multiValue = ref<string[]>([])
const textValue = ref('')
const numberValue = ref('')

const isEmpty = computed(() => {
  if (!props.question) return true
  if (props.question.type === 'single') return !singleValue.value
  if (props.question.type === 'multi') return multiValue.value.length === 0
  if (props.question.type === 'number') return !numberValue.value
  if (props.question.type === 'text') return !textValue.value.trim()
  return false
})

watch(
  () => props.question?.id,
  () => {
    singleValue.value = ''
    multiValue.value = []
    textValue.value = ''
    numberValue.value = ''
  }
)

function submit() {
  const question = props.question

  if (!question) return

  if (question.required && isEmpty.value) {
    showToast('请先完成当前问题')
    return
  }

  if (question.type === 'single') emit('submit', singleValue.value)
  if (question.type === 'multi') emit('submit', multiValue.value)
  if (question.type === 'text') emit('submit', textValue.value.trim())
  if (question.type === 'number') emit('submit', Number(numberValue.value))
}

function submitUnknown() {
  emit('submit', null)
}
</script>

<template>
  <div class="composer">
    <template v-if="question?.type === 'single'">
      <van-radio-group v-model="singleValue" class="option-grid">
        <van-radio
          v-for="option in question.options"
          :key="option.value"
          :name="option.value"
          class="option-tile"
        >
          {{ option.label }}
        </van-radio>
      </van-radio-group>
    </template>

    <template v-else-if="question?.type === 'multi'">
      <van-checkbox-group v-model="multiValue" class="option-grid">
        <van-checkbox
          v-for="option in question.options"
          :key="option.value"
          :name="option.value"
          class="option-tile"
        >
          {{ option.label }}
        </van-checkbox>
      </van-checkbox-group>
    </template>

    <template v-else-if="question?.type === 'text'">
      <van-field
        v-model="textValue"
        type="textarea"
        rows="2"
        autosize
        :placeholder="question.placeholder"
      />
    </template>

    <template v-else-if="question?.type === 'number'">
      <van-field
        v-model="numberValue"
        type="number"
        :placeholder="question.placeholder"
      >
        <template #right-icon>
          <span class="composer__unit">{{ question.unit }}</span>
        </template>
      </van-field>
    </template>

    <template v-else-if="question?.type === 'upload'">
      <van-button block icon="upgrade" @click="$emit('upload')">上传资料</van-button>
    </template>

    <div v-if="question && question.type !== 'upload'" class="composer__actions">
      <van-button
        v-if="question.allowUnknown"
        plain
        type="primary"
        class="composer__button"
        @click="submitUnknown"
      >
        不清楚
      </van-button>
      <van-button type="primary" class="composer__button" @click="submit">确定</van-button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  width: min(100%, 520px);
  margin: 0 auto;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.option-tile {
  min-height: 42px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  background: var(--theme-surface);
  padding: 9px 10px;
  line-height: 1.35;
}

.composer__actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.composer__button {
  flex: 1;
}

.composer__unit {
  color: var(--theme-text-muted);
  font-size: 14px;
}
</style>
