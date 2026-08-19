<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { showToast } from 'vant'
import type { AnswerValue, ConsultationQuestion } from '@/types/consultation'

const props = defineProps<{
  question?: ConsultationQuestion
  answer?: AnswerValue
}>()

const emit = defineEmits<{
  submit: [answer: AnswerValue]
  bodyPart: []
  upload: []
}>()

const singleValue = ref('')
const multiValue = ref<string[]>([])
const textValue = ref('')
const numberValue = ref('')

function hydrateAnswer(answer: AnswerValue | undefined) {
  if (!props.question || answer === null || answer === undefined) {
    singleValue.value = ''
    multiValue.value = []
    textValue.value = ''
    numberValue.value = ''
    return
  }

  if (props.question.type === 'single') singleValue.value = String(answer)
  if (props.question.type === 'multi') multiValue.value = Array.isArray(answer) ? answer.map(String) : [String(answer)]
  if (props.question.type === 'text') textValue.value = String(answer)
  if (props.question.type === 'number') numberValue.value = String(answer)
}

const isEmpty = computed(() => {
  if (!props.question) return true
  if (props.question.type === 'single') return !singleValue.value
  if (props.question.type === 'multi') return multiValue.value.length === 0
  if (props.question.type === 'number') return !numberValue.value
  if (props.question.type === 'text') return !textValue.value.trim()
  return false
})

watch(
  () => [props.question?.id, props.answer] as const,
  () => {
    hydrateAnswer(props.answer)
  },
  { immediate: true }
)

const showAllowUnknown = computed(() => {
  if (!props.question) return false
  if (props.question.required) return false
  if (!props.question.allowUnknown) return false
  const title = props.question.title || ''
  if (title.includes('性别') || title.includes('男') || title.includes('女')) return false
  return true
})

function isExclusiveOption(labelOrValue: string) {
  const text = labelOrValue.trim()
  return ['以上均不是', '以上均无', '均不是', '均无', '无', '没有', '否', '不清楚', '不确定'].some((keyword) => text === keyword || text.includes(keyword))
}

function isExclusiveValue(value: string) {
  const option = props.question?.options?.find((item) => String(item.value) === String(value))
  return isExclusiveOption(option?.label || value)
}

function handleSingleChange(value: unknown) {
  const nextValue = String(value)
  singleValue.value = nextValue
  emit('submit', nextValue)
}

function handleMultiChange(values: unknown[]) {
  const nextValues = values.map(String)
  const previousValues = multiValue.value
  const addedValue = nextValues.find((value) => !previousValues.includes(value))

  if (addedValue && isExclusiveValue(addedValue)) {
    multiValue.value = [addedValue]
    emit('submit', [addedValue])
    return
  }

  if (addedValue) {
    multiValue.value = nextValues.filter((value) => !isExclusiveValue(value))
    return
  }

  multiValue.value = nextValues
}

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
      <van-radio-group
        :model-value="singleValue"
        class="option-grid"
        @update:model-value="handleSingleChange"
      >
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
      <van-checkbox-group
        :model-value="multiValue"
        class="option-grid"
        @update:model-value="handleMultiChange"
      >
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

    <template v-else-if="question?.type === 'bodyPart'">
      <van-button block icon="location-o" @click="$emit('bodyPart')">选择不适部位</van-button>
    </template>

    <template v-else-if="question?.type === 'upload'">
      <van-button block icon="upgrade" @click="$emit('upload')">上传资料</van-button>
    </template>

    <div
      v-if="question && !['bodyPart', 'upload'].includes(question.type) && (question.type !== 'single' || showAllowUnknown)"
      class="composer__actions"
    >
      <van-button
        v-if="showAllowUnknown"
        plain
        type="primary"
        class="composer__button"
        @click="submitUnknown"
      >
        不清楚
      </van-button>
      <van-button
        v-if="question.type !== 'single'"
        type="primary"
        class="composer__button"
        @click="submit"
      >
        确定
      </van-button>
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
  max-height: min(42vh, 360px);
  margin-bottom: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.option-tile {
  min-height: 42px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  background: var(--theme-surface);
  padding: 9px 10px;
  line-height: 1.35;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-tile:active {
  background: var(--theme-primary-muted, #eef2ff);
}

.option-tile :deep(.van-radio__label),
.option-tile :deep(.van-checkbox__label) {
  width: 100%;
  color: var(--theme-text-strong);
  font-weight: 500;
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
