<script setup lang="ts">
import { computed } from 'vue'
import boyAvatar from '@/assets/image/boy.png'
import doctorAvatar from '@/assets/image/doctor.png'
import girlAvatar from '@/assets/image/girl.png'
import { useConsultationStore } from '@/stores/consultation'
import type { Gender } from '@/types/consultation'

const props = defineProps<{
  role: 'doctor' | 'patient'
  content: string
  questionId?: string
  editable?: boolean
  patientGender?: Gender | ''
}>()

const emit = defineEmits<{
  revise: [questionId: string]
}>()

const store = useConsultationStore()

const avatarUrl = computed(() => {
  if (props.role === 'doctor') return doctorAvatar

  return props.patientGender === 'female' ? girlAvatar : boyAvatar
})

const avatarAlt = computed(() => (props.role === 'doctor' ? '医生头像' : '患者头像'))
</script>

<template>
  <div class="chat-row" :class="`chat-row--${role}`">
    <img
      v-if="role === 'doctor'"
      class="avatar"
      :src="avatarUrl"
      :alt="avatarAlt"
    />
    <div class="chat-stack">
      <div class="bubble">
        <div class="bubble__text">{{ content }}</div>
      </div>
      <button
        v-if="role === 'patient' && editable && questionId && !store.readOnly"
        class="bubble__edit"
        type="button"
        @click="emit('revise', questionId)"
      >
        修改
      </button>
    </div>
    <img
      v-if="role === 'patient'"
      class="avatar"
      :src="avatarUrl"
      :alt="avatarAlt"
    />
  </div>
</template>

<style scoped>
.chat-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 20px 0;
}

.chat-row--patient {
  justify-content: flex-end;
}

.avatar {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
}

.chat-stack {
  max-width: calc(100% - 46px);
}

.chat-row--patient .chat-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bubble {
  position: relative;
  border-radius: 8px;
  padding: 11px 13px;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
}

.chat-row--doctor .bubble {
  border-top-left-radius: 4px;
  background: #fff;
  color: #2b3340;
}

.chat-row--patient .bubble {
  border-top-right-radius: 4px;
  background: var(--theme-chat-patient-bg);
  color: var(--theme-on-primary);
}

.chat-row--doctor .bubble::before,
.chat-row--patient .bubble::before {
  position: absolute;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  content: "";
}

.chat-row--doctor .bubble::before {
  left: -6px;
  border-right: 7px solid #fff;
}

.chat-row--patient .bubble::before {
  right: -6px;
  border-left: 7px solid #2488fa;
}

.bubble__edit {
  border: 0;
  background: transparent;
  color: #2488fa;
  padding: 4px 2px 0;
  font-size: 14px;
  line-height: 1.3;
}
</style>
