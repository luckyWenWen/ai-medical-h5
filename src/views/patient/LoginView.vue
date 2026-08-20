<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { loginWithPassword } from '@/api/request'
import { useConsultationStore } from '@/stores/consultation'
import loginBg from '@/assets/image/loginBg.png'

const route = useRoute()
const router = useRouter()
const store = useConsultationStore()
const username = ref('')
const password = ref('')
const agreed = ref(false)
const loggingIn = ref(false)

function openAgreement(type: 'service' | 'privacy') {
  router.push({
    name: type === 'service' ? 'service-agreement' : 'privacy-agreement',
    query: { from: 'login' }
  })
}

async function handleLogin() {
  if (loggingIn.value) return
  if (!username.value.trim()) {
    showToast('请输入账号')
    return
  }
  if (!password.value) {
    showToast('请输入密码')
    return
  }
  if (!agreed.value) {
    showToast('请先阅读并同意服务协议和隐私协议')
    return
  }

  loggingIn.value = true

  try {
    const auth = await loginWithPassword(username.value.trim(), password.value)
    if (!auth.token) {
      showToast('登录接口未返回 Token')
      return
    }
    store.setPatientAuth(auth)
    await store.loadCurrentPatientAuth()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    await router.replace(redirect)
  } catch (error: any) {
    showToast(error?.response?.data?.message || error?.response?.data?.msg || error?.message || '登录失败')
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <div class="login-page" :style="{ backgroundImage: `url(${loginBg})` }">
    <main class="login-content">
      <div class="login-form">
        <div class="login-title">
          <h1>欢迎使用智能预问诊</h1>
          <p class="login-subtitle">登录后享受便捷的智慧医疗服务</p>
        </div>

        <div class="login-input mpb-10">
          <van-icon name="phone-o" />
          <input id="username" v-model="username" inputmode="text" maxlength="32" placeholder="请输入账号" />
        </div>

        <div class="login-input mpb-10">
          <van-icon name="shield-o" />
          <input id="password" v-model="password" type="password" maxlength="32" placeholder="请输入密码" />
        </div>

        <div class="agreement-row">
          <van-checkbox v-model="agreed" icon-size="16" shape="square">
            <template #default>
              <span>我已阅读并同意</span>
              <button type="button" class="agreement-link" @click.stop="openAgreement('service')">《服务协议》</button>
              <span>和</span>
              <button type="button" class="agreement-link" @click.stop="openAgreement('privacy')">《隐私协议》</button>
            </template>
          </van-checkbox>
        </div>

        <van-button class="login-button" type="primary" block :loading="loggingIn" @click="handleLogin">
          登录
        </van-button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  background-color: #fff;
  background-repeat: no-repeat;
  background-position: top center;
  background-size: cover;
  color: #1f2a3d;
}

.login-page::before {
  position: fixed;
  inset: 0;
  content: "";
  /* background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.86) 58%, #fff 100%); */
  pointer-events: none;
}

.login-content {
  position: relative;
  z-index: 1;
  width: min(100%, 520px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 70% 16px 22px;
}

.login-title {
  margin-bottom: 26px;
}

.login-title h1 {
  margin: 0;
  color: #202b3f;
  text-align: center;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.4;
}

.login-subtitle {
  margin: 6px 0 0;
  color: #a5afbe;
  text-align: center;
  font-size: 13px;
}

.login-form {
  border: 1px solid rgba(228, 234, 242, 0.72);
  border-radius: 12px;
  /* background: rgba(255, 255, 255, 0.9); */
  background: transparent;
  padding: 22px 14px 16px;
  box-shadow: 0 12px 28px rgba(31, 42, 61, 0.08);
  backdrop-filter: blur(10px);
}

.login-form .mpb-10:first-child {
  margin-top: 0;
}

.login-form .login-button {
  margin-top: 4px;
}

.login-input {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 46px;
  padding: 0 15px;
  border: 1px solid #e4eaf2;
  border-radius: 10px;
  background: #f8fafc;
}

.mpb-10 {
  margin: 22px 0 18px;
}

.login-input .van-icon {
  flex: 0 0 auto;
  margin-right: 12px;
  color: #a8b3c2;
  font-size: 18px;
}

.login-input input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #29364b;
  font-size: 15px;
}

.login-input input::placeholder {
  color: #c7d0dd;
}

.agreement-row {
  margin: 20px 0 28px;
  color: #9ca8b8;
  font-size: 12px;
}

.agreement-row :deep(.van-checkbox__label) {
  line-height: 1.5;
}

.agreement-row :deep(.van-checkbox__icon--checked .van-icon) {
  border-color: #286bf0;
  background: #286bf0;
}

.agreement-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #286bf0;
  font-size: inherit;
}

.login-button {
  height: 45px;
  border: 0;
  border-radius: 24px;
  background: #2868ed;
  box-shadow: none;
  font-size: 16px;
  font-weight: 700;
}

/* @media (max-height: 720px) {
  .login-content {
    padding-top: 210px;
  }
}

@media (max-height: 640px) {
  .login-content {
    padding-top: 260px;
  }
} */
</style>
