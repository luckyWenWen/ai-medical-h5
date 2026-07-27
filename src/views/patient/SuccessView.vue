<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'

const router = useRouter()
const store = useConsultationStore()

function restart() {
  store.reset()
  router.replace('/')
}
</script>

<template>
  <div class="page">
    <AppNavBar title="提交成功" />
    <main class="page-body success">
      <van-icon name="checked" class="success__icon" />
      <h1>提交成功</h1>
      <p class="muted">问诊编号</p>
      <strong class="success__no">{{ store.consultationNo }}</strong>

      <section class="status surface">
        <van-cell title="当前状态" value="已提交" />
        <van-cell title="医生查看" value="待查看" />
        <van-cell title="HIS/EMR 同步" value="待医生确认" />
      </section>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block @click="restart">返回首页</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.success {
  text-align: center;
  padding-top: 48px;
}

.success__icon {
  color: var(--theme-success);
  font-size: 62px;
}

h1 {
  margin: 12px 0 12px;
  font-size: 24px;
}

.success__no {
  display: block;
  margin: 8px 0 22px;
  font-size: 20px;
  color: var(--theme-primary);
}

.status {
  overflow: hidden;
  text-align: left;
}
</style>
