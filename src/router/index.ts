import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/patient/HomeView.vue'),
      meta: { title: '智能预问诊' }
    },
    {
      path: '/visit',
      name: 'visit',
      component: () => import('@/views/patient/VisitInfoView.vue'),
      meta: { title: '就诊信息' }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/patient/ProfileView.vue'),
      meta: { title: '基本信息' }
    },
    {
      path: '/consultation',
      name: 'consultation',
      component: () => import('@/views/patient/ConsultationView.vue'),
      meta: { title: '智能问诊' }
    },
    {
      path: '/body',
      name: 'body',
      component: () => import('@/views/patient/BodySelectorView.vue'),
      meta: { title: '部位选择' }
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/patient/UploadView.vue'),
      meta: { title: '上传资料' }
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('@/views/patient/ReportView.vue'),
      meta: { title: '报告确认' }
    },
    {
      path: '/success',
      name: 'success',
      component: () => import('@/views/patient/SuccessView.vue'),
      meta: { title: '提交成功' }
    }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  document.title = String(to.meta.title || '智能预问诊')
})

export default router
