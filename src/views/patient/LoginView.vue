<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { loginWithSms, sendSmsCode } from '@/api/request'

const router = useRouter()
const route = useRoute()
const phone = ref('')
const code = ref('')
const agreed = ref(false)
const sendingCode = ref(false)
const loggingIn = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | undefined

const canSendCode = computed(() => /^1\d{10}$/.test(phone.value) && countdown.value === 0)

function openAgreement(type: 'service' | 'privacy') {
  router.push({ name: type === 'service' ? 'service-agreement' : 'privacy-agreement' })
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(phone.value)) {
    showToast('请输入正确的手机号')
    return
  }
  if (sendingCode.value || countdown.value > 0) return

  sendingCode.value = true
  try {
    await sendSmsCode(phone.value)
    showToast('验证码已发送')
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = undefined
      }
    }, 1000)
  } catch (error: any) {
    showToast(error?.response?.data?.message || error?.response?.data?.msg || '验证码发送失败，请稍后重试')
  } finally {
    sendingCode.value = false
  }
}

async function handleLogin() {
  if (!/^1\d{10}$/.test(phone.value)) {
    showToast('请输入正确的手机号')
    return
  }
  if (!/^\d{4,6}$/.test(code.value)) {
    showToast('请输入正确的验证码')
    return
  }
  if (!agreed.value) {
    showToast('请先阅读并同意服务协议和隐私协议')
    return
  }

  loggingIn.value = true
  try {
    const token = await loginWithSms(phone.value, code.value)
    if (!token) {
      showToast('登录失败，请检查验证码')
      return
    }
    localStorage.setItem('patient_phone', phone.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    router.replace(redirect)
  } catch (error: any) {
    showToast(error?.response?.data?.message || error?.response?.data?.msg || '登录失败，请稍后重试')
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- <van-nav-bar class="login-nav safe-top" title="登录" left-arrow @click-left="router.back()" /> -->

    <main class="login-content">
      <div class="login-brand" aria-hidden="true">
        <van-icon name="like-o" />
        <span class="login-brand__pulse"></span>
      </div>
      <h1>欢迎使用智能预问诊</h1>
      <p class="login-subtitle">登录后享受便捷的智慧医疗服务</p>

      <div class="login-form">
        <div class="login-input mpb-10">
          <van-icon name="phone-o" />
          <input id="phone" v-model="phone" inputmode="numeric" maxlength="11" placeholder="请输入手机号" />
        </div>

        <div class="login-code-row">
          <div class="login-input">
            <van-icon name="shield-o" />
            <input id="code" v-model="code" inputmode="numeric" maxlength="6" placeholder="请输入验证码" />
          </div>
          <van-button
            class="send-code"
            type="primary"
            plain
            :loading="sendingCode"
            :disabled="!canSendCode"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
          </van-button>
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

      <div class="other-login">
        <div class="other-login__title"><span>其他方式登录</span></div>
        <div class="other-login__options">
          <button type="button" class="other-login__item" @click="showToast('微信登录即将开放')">
            <span class="other-login__icon other-login__icon--wechat"><van-icon name="chat-o" /></span>
            <span>微信</span>
          </button>
          <button type="button" class="other-login__item" @click="showToast('支付宝登录即将开放')">
            <span class="other-login__icon other-login__icon--alipay"><van-icon name="smile-o" /></span>
            <span>支付宝</span>
          </button>
        </div>
      </div>

      <p class="login-footnote">未注册手机号将自动创建账号</p>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #fff;
  color: #1f2a3d;
}

.login-nav {
  --van-nav-bar-height: 39px;
  box-shadow: none;
}

.login-nav :deep(.van-nav-bar__title) {
  font-size: 15px;
}

.login-nav :deep(.van-icon) {
  font-size: 20px;
}

.login-content {
  width: min(100%, 520px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 48px 16px 22px;
}

.login-brand {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 78px auto 22px;
  overflow: hidden;
  border-radius: 16px;
  background: #eef5ff;
  color: #2768ef;
}

.login-brand .van-icon {
  z-index: 1;
  font-size: 36px;
}

.login-brand__pulse {
  position: absolute;
  width: 36px;
  height: 9px;
  border-top: 2px solid #2768ef;
  border-radius: 50%;
  transform: rotate(-12deg);
}

.login-content h1 {
  margin: 0;
  color: #202b3f;
  text-align: center;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.4;
}

.login-subtitle {
  margin: 6px 0 38px;
  color: #a5afbe;
  text-align: center;
  font-size: 13px;
}

.login-form {
  padding: 0;
}

.login-label {
  display: block;
  margin: 0 0 7px;
  color: #506077;
  font-size: 12px;
  line-height: 1;
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

.login-code-row {
  display: flex;
  gap: 10px;
}

.login-code-row > .login-input {
  flex: 1;
}

.send-code {
  flex: 0 0 92px;
  height: 46px;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  background: #eef5ff;
  color: #286bf0;
  font-size: 12px;
}

.send-code:disabled {
  color: #bdc9d8;
  background: #f3f6fa;
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

.other-login {
  margin-top: 38px;
}

.other-login__title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #c1c9d4;
  font-size: 12px;
}

.other-login__title::before,
.other-login__title::after {
  flex: 1;
  height: 1px;
  content: "";
  background: #edf0f4;
}

.other-login__options {
  display: flex;
  justify-content: center;
  gap: 35px;
  margin-top: 22px;
}

.other-login__item {
  display: grid;
  justify-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #97a3b3;
  font-size: 12px;
}

.other-login__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font-size: 20px;
}

.other-login__icon--wechat {
  color: #20bd62;
  background: #effbf3;
}

.other-login__icon--alipay {
  color: #286bf0;
  background: #f0f5ff;
}

.login-footnote {
  margin: 34px 0 0;
  color: #d0d6de;
  text-align: center;
  font-size: 11px;
}
</style>
