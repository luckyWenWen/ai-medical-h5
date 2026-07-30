<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import QuestionComposer from '@/components/QuestionComposer.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { AnswerValue } from '@/types/consultation'

const router = useRouter()
const route = useRoute()
const store = useConsultationStore()
const chatBody = ref<HTMLElement>()
const progress = computed(() => Math.min(store.progressPercent, 100))

onMounted(async () => {
  if (route.query.revise === '1' && (await store.resumeForRevision())) {
    scrollToBottom()
    return
  }

  if (!store.questions.length || !store.messages.length) {
    await store.loadQuestions()
  } else {
    store.ensureCurrentQuestionMessage()
  }
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
  // 必须等待答案保存与索引推进完成后，才能正确判断问卷是否已答完
  await store.answerCurrent(value)

  if (!store.currentQuestion || store.currentIndex >= store.questions.length) {
    if (store.hasUnansweredRequiredQuestions) {
      showToast('还有未回答的题目，请继续回答')
      if (store.firstUnansweredIndex >= 0) {
        store.currentIndex = store.firstUnansweredIndex
        store.ensureCurrentQuestionMessage()
        scrollToBottom()
      }
      return
    }
    await store.buildReport()
    store.finishRevision()
    router.push('/report')
  }
}

function finishRevision() {
  if (store.hasUnansweredRequiredQuestions) {
    showToast('还有未回答的题目，请继续回答')
    if (store.firstUnansweredIndex >= 0) {
      store.currentIndex = store.firstUnansweredIndex
      store.ensureCurrentQuestionMessage()
      scrollToBottom()
    }
    return
  }
  store.buildReport().then(() => {
    store.finishRevision()
    router.push('/report')
  })
}

function upload() {
  router.push('/upload')
}

function selectBodyPart() {
  router.push('/body')
}
</script>

<template>
  <div class="page consult-page">
    <AppNavBar title="智能问诊" back />
    <van-notice-bar
      v-if="store.readOnly"
      color="#059669"
      background="#ecfdf5"
      left-icon="info-o"
      text="本次预问诊已提交成功，记录仅供查看，无法修改。"
    />
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

    <div v-if="store.readOnly" class="fixed-action">
      <van-button block disabled type="primary">本次预问诊已经提交，仅供查看</van-button>
    </div>
    <div v-else-if="store.currentQuestion && !store.isRevising" class="fixed-action">
      <QuestionComposer
        :question="store.currentQuestion"
        :answer="store.answers[store.currentQuestion.id]"
        @submit="answer"
        @body-part="selectBodyPart"
        @upload="upload"
      />
    </div>
    <div v-else-if="store.isRevising && store.currentQuestion" class="fixed-action">
      <QuestionComposer
        :question="store.currentQuestion"
        :answer="store.answers[store.currentQuestion.id]"
        @submit="answer"
        @body-part="selectBodyPart"
        @upload="upload"
      />
      <van-button type="primary" block class="finish-revision-btn" @click="finishRevision">
        完成修改
      </van-button>
    </div>
    <div v-else-if="store.isRevising && !store.currentQuestion" class="fixed-action">
      <van-button type="primary" block @click="finishRevision">
        完成修改，查看报告
      </van-button>
    </div>
    <div v-else class="fixed-action">
      <van-button type="primary" block @click="finishRevision">
        完成问诊，查看报告
      </van-button>
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

.finish-revision-btn {
  margin-top: 8px;
}
</style>
