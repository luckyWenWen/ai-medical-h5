<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import QuestionComposer from '@/components/QuestionComposer.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { AnswerValue } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const chatBody = ref<HTMLElement>()
const progress = computed(() => Math.min(store.progressPercent, 100))

onMounted(async () => {
  await store.loadQuestions()
  scrollToBottom()
})

watch(
  () => store.messages.length,
  () => scrollToBottom()
)

function scrollToBottom() {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight
    }
  })
}

async function answer(value: AnswerValue) {
  store.answerCurrent(value)

  if (!store.currentQuestion) {
    await store.buildReport()
    router.push('/report')
  }
}

function upload() {
  router.push('/upload')
}
</script>

<template>
  <div class="page consult-page">
    <AppNavBar title="智能问诊" back />
    <van-progress :percentage="progress" stroke-width="4" :show-pivot="false" />

    <main ref="chatBody" class="chat-body">
      <div class="chat-body__inner">
        <ChatBubble
          v-for="message in store.messages"
          :key="message.id"
          :role="message.role"
          :content="message.content"
          :question-id="message.questionId"
          :editable="message.role === 'patient'"
          :patient-gender="store.profile.gender"
          @revise="store.reviseQuestion"
        />
      </div>
    </main>

    <div v-if="store.currentQuestion" class="fixed-action">
      <QuestionComposer
        :question="store.currentQuestion"
        @submit="answer"
        @upload="upload"
      />
    </div>
  </div>
</template>

<style scoped>
.consult-page {
  height: 100vh;
  overflow: hidden;
}

.chat-body {
  height: calc(100vh - 102px - env(safe-area-inset-bottom));
  overflow-y: auto;
  padding: 10px 14px 210px;
}

.chat-body__inner {
  width: min(100%, 520px);
  margin: 0 auto;
}

.consult-page .fixed-action {
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
