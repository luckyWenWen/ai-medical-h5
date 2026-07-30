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
    <div class="bubble">
      <div class="bubble__text">{{ content }}</div>
      <button
        v-if="role === 'patient' && editable && questionId && !store.readOnly"
        class="bubble__edit"
        type="button"
        @click="emit('revise', questionId)"
      >
        重新修改
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
  margin: 12px 0;
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

.bubble {
  max-width: 78%;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
}

.chat-row--doctor .bubble {
  background: var(--theme-chat-doctor-bg);
  border: 1px solid var(--theme-border);
}

.chat-row--patient .bubble {
  background: var(--theme-chat-patient-bg);
  color: var(--theme-on-primary);
}

.bubble__edit {
  display: block;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.86;
  padding: 6px 0 0;
  font-size: 12px;
}
</style>
