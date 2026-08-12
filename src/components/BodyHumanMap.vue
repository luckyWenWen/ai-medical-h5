<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QuestionOption } from '@/types/consultation'
import bodyMainImg from '@/assets/image/body/physicalSelect.png'
import tbImg from '@/assets/image/body/physicalSelect_tb.png'
import jbImg from '@/assets/image/body/physicalSelect_jb.png'
import xbImg from '@/assets/image/body/physicalSelect_xb.png'
import jzImg from '@/assets/image/body/physicalSelect_jz.png'
import fbImg from '@/assets/image/body/physicalSelect_fb.png'
import mnImg from '@/assets/image/body/physicalSelect_mn.png'
import szImg from '@/assets/image/body/physicalSelect_sz.png'

interface BodyPartButton {
  key: string
  label: string
  aliases?: string[]
  centerY: number
  line?: {
    x: number
    y: number
  }
}

interface BodyPartView extends BodyPartButton {
  option: QuestionOption
}

interface MatchedOption extends QuestionOption {
  fallback?: boolean
}

const props = defineProps<{
  options: QuestionOption[]
  selectedCodes: string[]
  maxSelections: number
}>()

const emit = defineEmits<{
  toggle: [code: string]
}>()

const lastSelectedValue = ref('')

const bodyMain = bodyMainImg
const highlightMap: Record<string, string> = {
  tb: tbImg,
  jb: jbImg,
  xb: xbImg,
  jz: jzImg,
  fb: fbImg,
  mn: mnImg,
  sz: szImg
}

const bodyParts: BodyPartButton[] = [
  { key: 'tb', label: '头部', aliases: ['头面部'], centerY: 48, line: { x: 160, y: 48 } },
  { key: 'jb', label: '颈部', aliases: ['颈椎区域'], centerY: 98, line: { x: 160, y: 98 } },
  { key: 'xb', label: '胸部', aliases: ['胸部及背部', '胸椎及背部'], centerY: 138, line: { x: 160, y: 138 } },
  { key: 'jz', label: '脊柱', aliases: ['颈椎区域', '胸椎及背部', '腰骶部'], centerY: 188, line: { x: 145, y: 188 } },
  { key: 'fb', label: '腹部', aliases: ['上腹部', '下腹部及盆腔'], centerY: 228, line: { x: 160, y: 228 } },
  { key: 'mn', label: '盆腔', aliases: ['下腹部及盆腔'], centerY: 268, line: { x: 150, y: 268 } },
  { key: 'shenj', label: '神经系统', aliases: ['神经'], centerY: 358, line: { x: 180, y: 358 } },
  { key: 'sz', label: '四肢', aliases: ['肩部及上肢', '手腕及手部', '髋部及下肢', '膝部', '踝部及足部'], centerY: 458, line: { x: 190, y: 458 } }
]

function matchOption(part: BodyPartButton, index: number): MatchedOption {
  const names = [part.label, ...(part.aliases || [])]
  const matched = props.options.find((item) => names.some((name) => item.label.includes(name) || name.includes(item.label)))
  if (matched) return matched
  if (props.options[index]) return props.options[index]
  return { label: part.label, value: part.key, fallback: true }
}

const visibleParts = computed<BodyPartView[]>(() => {
  const usedValues = new Set<string>()
  return bodyParts
    .map((part, index) => {
      const option = matchOption(part, index)

      if (!option || (!option.fallback && usedValues.has(option.value))) return null
      if (!option.fallback) {
        usedValues.add(option.value)
      }
      return {
        ...part,
        option
      }
    })
    .filter((item): item is BodyPartView => Boolean(item))
})

const selectedHighlight = computed(() => {
  const lastSelectedPart = visibleParts.value.find((part) => part.option.value === lastSelectedValue.value)
  const selectedPart = props.selectedCodes.includes(lastSelectedValue.value)
    ? lastSelectedPart
    : visibleParts.value.find((part) => props.selectedCodes.includes(part.option.value))
  if (selectedPart?.key && highlightMap[selectedPart.key]) {
    return highlightMap[selectedPart.key]
  }
  return ''
})

function getButtonY(part: BodyPartView) {
  return part.centerY
}

function isSelected(value: string) {
  return props.selectedCodes.includes(value)
}

function togglePart(part: BodyPartView) {
  lastSelectedValue.value = part.option.value
  emit('toggle', part.option.value)
}
</script>

<template>
  <section class="body-map">
    <div class="body-map__stage">
      <div class="body-map__image-wrap">
        <img class="body-map__main" :src="bodyMain" alt="人体部位图" />
        <img v-if="selectedHighlight" class="body-map__highlight" :src="selectedHighlight" alt="" />
      </div>

      <div class="body-map__buttons">
        <button
          v-for="part in visibleParts"
          :key="part.key"
          type="button"
          class="body-map__button"
          :class="{ active: isSelected(part.option.value) }"
          :style="{ top: `${part.centerY}px` }"
          :aria-pressed="isSelected(part.option.value)"
          @click="togglePart(part)"
        >
          {{ part.label }}
        </button>
      </div>

      <svg class="body-map__lines" viewBox="0 0 420 600" aria-hidden="true">
        <template v-for="part in visibleParts" :key="part.key">
          <line
            v-if="part.line"
            :x1="part.line.x"
            :y1="part.line.y"
            x2="371"
            :y2="getButtonY(part)"
            stroke="#8fd3f4"
            stroke-width="2"
          />
        </template>
      </svg>
    </div>

    <div class="body-map__count">
      已选择 {{ selectedCodes.length }} / {{ maxSelections }}
    </div>
  </section>
</template>

<style scoped>
.body-map {
  min-height: 610px;
  background: #fff;
}

.body-map__stage {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 600px;
  align-items: flex-start;
  overflow: hidden;
}

.body-map__image-wrap {
  position: relative;
  width: calc(100% - 104px);
  max-width: 340px;
  height: 600px;
  flex: 1 1 auto;
}

.body-map__main,
.body-map__highlight {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.body-map__main {
  z-index: 0;
}

.body-map__highlight {
  z-index: 1;
  pointer-events: none;
}

.body-map__lines {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 600px;
  overflow: visible;
  pointer-events: none;
}

.body-map__buttons {
  position: relative;
  width: 104px;
  height: 600px;
  flex: 0 0 104px;
}

.body-map__button {
  position: absolute;
  right: 0;
  z-index: 3;
  display: inline-flex;
  width: 98px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #8fd3f4;
  border-radius: 8px;
  background: #fff;
  color: #17233c;
  font-size: 14px;
  line-height: 1;
  text-align: center;
  transform: translateY(-50%);
}

.body-map__button.active {
  border-color: var(--theme-primary);
  background: #eaf6ff;
  color: var(--theme-primary);
  font-weight: 700;
}

.body-map__count {
  width: fit-content;
  margin: -18px 0 0 auto;
  border-radius: 999px;
  background: rgba(36, 136, 250, 0.08);
  padding: 6px 12px;
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 370px) {
  .body-map__image-wrap {
    width: calc(100% - 94px);
  }

  .body-map__buttons {
    width: 94px;
    flex-basis: 94px;
  }

  .body-map__button {
    width: 88px;
    font-size: 13px;
  }
}
</style>
