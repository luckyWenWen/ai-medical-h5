import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/patient/LoginView.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/patient/HomeView.vue'),
      meta: { title: '智能预问诊' }
    },
    {
      path: '/agreement/service',
      name: 'service-agreement',
      component: () => import('@/views/patient/AgreementView.vue'),
      meta: { title: '服务协议' }
    },
    {
      path: '/agreement/privacy',
      name: 'privacy-agreement',
      component: () => import('@/views/patient/AgreementView.vue'),
      meta: { title: '隐私协议' }
    },
    {
      path: '/visit',
      name: 'visit',
      component: () => import('@/views/patient/VisitInfoView.vue'),
      meta: { title: '就诊信息', requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/patient/ProfileView.vue'),
      meta: { title: '基本信息', requiresAuth: true }
    },
    {
      path: '/mine',
      name: 'mine',
      component: () => import('@/views/patient/MineView.vue'),
      meta: { title: '我的' }
    },
    {
      path: '/complaintFeedback',
      name: 'complaintFeedback',
      component: () => import('@/views/patient/ComplaintFeedbackView.vue'),
      meta: { title: '投诉与反馈' }
    },
    {
      path: '/my-records',
      name: 'my-records',
      component: () => import('@/views/patient/MyRecordsView.vue'),
      meta: { title: '我的问诊记录', requiresAuth: true }
    },
    {
      path: '/consultation',
      name: 'consultation',
      component: () => import('@/views/patient/ConsultationView.vue'),
      meta: { title: '智能问诊', requiresAuth: true }
    },
    {
      path: '/body',
      name: 'body',
      component: () => import('@/views/patient/BodySelectorView.vue'),
      meta: { title: '部位选择', requiresAuth: true }
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/patient/UploadView.vue'),
      meta: { title: '上传资料', requiresAuth: true }
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('@/views/patient/ReportView.vue'),
      meta: { title: '报告确认', requiresAuth: true }
    },
    {
      path: '/success',
      name: 'success',
      component: () => import('@/views/patient/SuccessView.vue'),
      meta: { title: '提交成功', requiresAuth: true }
    }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

import { extractAndSaveUrlToken } from '@/api/request'
import { useConsultationStore } from '@/stores/consultation'

router.beforeEach(async (to, from) => {
  if (to.query.token || to.query.satoken || to.query.ticket) {
    const rawToken = String(to.query.token || to.query.satoken || to.query.ticket)
    if (rawToken) {
      localStorage.setItem('patient_token', rawToken.replace(/^Bearer\s+/i, ''))
    }
  } else {
    extractAndSaveUrlToken()
  }

  const isBackFromLoginAgreement =
    (from.name === 'service-agreement' || from.name === 'privacy-agreement') &&
    from.query.from === 'login'

  if (
    to.name === 'login' &&
    localStorage.getItem('patient_token') &&
    !to.query.redirect &&
    !isBackFromLoginAgreement
  ) {
    return { name: 'home' }
  }

  const store = useConsultationStore()
  if (to.meta.requiresAuth && !localStorage.getItem('patient_token')) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }
  if (to.meta.requiresAuth && localStorage.getItem('patient_token') && !store.patientAuth) {
    await store.loadCurrentPatientAuth()
  }

  if (to.name === 'consultation') {
    const hasRestoredRecord = Boolean(store.recordId && store.questions.length)
    if (!hasRestoredRecord && (!store.visitInfo.department || !store.profile.name || !store.profile.phone)) {
      return { name: 'visit' }
    }
    if (store.isSubmittedRecord) {
      return { name: 'report' }
    }
  } else if (to.name === 'report') {
    if (!store.isSubmittedRecord && (store.hasUnansweredRequiredQuestions || !store.questions.length)) {
      return { name: 'consultation' }
    }
  }
})

router.afterEach((to) => {
  document.title = String(to.meta.title || '智能预问诊')
})

export default router
