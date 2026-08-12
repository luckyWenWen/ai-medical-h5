<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useConsultationStore } from '@/stores/consultation'

const router = useRouter()
const store = useConsultationStore()

const appVersion = 'v2.1.0'

const userName = computed(() => store.profile.name || '张先生')
const userPhone = computed(() => store.profile.phone || localStorage.getItem('patient_phone') || '138****5678')
const maskedPhone = computed(() => maskPhone(userPhone.value))

const settingItems = [
  {
    icon: 'orders-o',
    tone: 'blue',
    title: '我的问诊记录',
    desc: '查看历史预问诊报告',
    action: openRecords
  },
  {
    icon: 'comment-o',
    tone: 'orange',
    title: '投诉与反馈',
    desc: '意见反馈与投诉建议',
    action: () => router.push({ name: 'complaintFeedback' })
  },
  {
    icon: 'replay',
    tone: 'purple',
    title: '检查更新',
    desc: `当前版本 ${appVersion}`,
    tag: '有新版本',
    action: () => showToast('当前已是最新版本')
  },
  {
    icon: 'shield-o',
    tone: 'green',
    title: '隐私协议',
    desc: '了解我们如何保护您的隐私',
    action: () => router.push({ name: 'privacy-agreement' })
  },
  {
    icon: 'description',
    tone: 'slate',
    title: '服务协议',
    desc: '查看用户服务协议条款',
    action: () => router.push({ name: 'service-agreement' })
  }
]

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone || '138****5678'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function openProfile() {
  router.push('/profile')
}

function openRecords() {
  router.push({ name: 'my-records' })
}

function logout() {
  localStorage.removeItem('patient_token')
  localStorage.removeItem('csrf_token')
  localStorage.removeItem('patient_phone')
  store.$reset()
  store.persist()
  router.replace('/login')
}
</script>

<template>
  <div class="page mine-page">
    <van-nav-bar class="safe-top" title="我的" left-arrow fixed placeholder @click-left="router.back()">
      <!-- <template #right>
        <button type="button" class="nav-icon-button" aria-label="设置" @click="showToast('设置功能建设中')">
          <van-icon name="setting-o" />
        </button>
      </template> -->
    </van-nav-bar>

    <main class="mine-body">
      <button type="button" class="profile-card" @click="openProfile">
        <span class="profile-card__avatar" aria-hidden="true">
          <van-icon name="manager-o" />
        </span>
        <span class="profile-card__content">
          <strong>{{ userName }}</strong>
          <span>
            <van-icon name="phone-o" />
            {{ maskedPhone }}
          </span>
        </span>
        <van-icon name="arrow" class="profile-card__arrow" />
      </button>

   

      <section class="settings-section" aria-labelledby="mine-settings-title">
        <!-- <h2 id="mine-settings-title">服务与设置</h2> -->
        <div class="settings-list">
          <button
            v-for="item in settingItems"
            :key="item.title"
            type="button"
            class="settings-item"
            @click="item.action"
          >
            <span class="settings-item__icon" :class="`settings-item__icon--${item.tone}`" aria-hidden="true">
              <van-icon :name="item.icon" />
            </span>
            <span class="settings-item__content">
              <strong>{{ item.title }}</strong>
              <small>
                {{ item.desc }}
                <em v-if="item.tag">{{ item.tag }}</em>
              </small>
            </span>
            <van-icon name="arrow" class="settings-item__arrow" />
          </button>
        </div>
      </section>

      <button type="button" class="logout-button" @click="logout">退出登录</button>
    </main>
  </div>
</template>

<style scoped>
.mine-page {
  min-height: 100vh;
  background: #f7f9fc;
}

.mine-body {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 20px 0px calc(22px + env(safe-area-inset-bottom));
}

.nav-icon-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 19px;
}

.profile-card,
.health-card,
.settings-item,
.logout-button {
  width: 100%;
  border: 0;
  text-align: left;
  letter-spacing: 0;
  appearance: none;
  -webkit-appearance: none;
}
.logout-button{
  width: 90% !important;
  margin: 0 auto;
}
.profile-card {
  display: grid;
  grid-template-columns: 48px 1fr 18px;
  gap: 14px;
  align-items: center;
  min-height: 78px;
  padding: 16px;
  background: #fff;
  color: #333;
}

.profile-card__avatar {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 27px;
}

.profile-card__content,
.health-card span:last-of-type,
.settings-item__content {
  min-width: 0;
  display: grid;
}

.profile-card__content {
  gap: 6px;
}

.profile-card__content strong {
  font-size: 16px;
  line-height: 1.2;
}

.profile-card__content span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 12px;
  line-height: 1.2;
}

.profile-card__arrow,
.health-card__arrow,
.settings-item__arrow {
  justify-self: end;
  color: currentColor;
}

.health-card {
  display: grid;
  grid-template-columns: 38px 1fr 18px;
  gap: 12px;
  align-items: center;
  min-height: 60px;
  margin-top: 12px;
  padding: 11px 14px;
  border: 1px solid #b9ebcf;
  border-radius: 8px;
  background: #effcf4;
  color: #17ad63;
}

.health-card__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #d9f9e5;
  font-size: 18px;
}

.health-card strong,
.settings-item strong {
  color: #1d2939;
  font-size: 14px;
  line-height: 1.25;
}

.health-card small,
.settings-item small {
  margin-top: 4px;
  color: #8b9bb0;
  font-size: 11px;
  line-height: 1.3;
}

.health-card small {
  color: #22b86c;
}

.settings-section {
  margin-top: 22px;
}

.settings-section h2 {
  margin: 0 18px 8px;
  color: #8090a6;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.settings-list {
  overflow: hidden;
  border: 1px solid #eef2f6;
  /* border-radius: 8px; */
  background: #fff;
}

.settings-item {
  display: grid;
  grid-template-columns: 34px 1fr 18px;
  gap: 12px;
  align-items: center;
  min-height: 55px;
  padding: 20px 20px;
  background: #fff;
}

.settings-item + .settings-item {
  border-top: 1px solid #f3f5f8;
}

.settings-item__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 16px;
}

.settings-item__icon--blue {
  background: #eef5ff;
  color: #2f6df6;
}

.settings-item__icon--orange {
  background: #fff4e8;
  color: #ff7a1a;
}

.settings-item__icon--purple {
  background: #f2ebff;
  color: #7c45ff;
}

.settings-item__icon--green {
  background: #eafbf1;
  color: #18b864;
}

.settings-item__icon--slate {
  background: #eef3f8;
  color: #63758c;
}

.settings-item__arrow {
  color: #c7d0dc;
  font-size: 16px;
}

.settings-item small em {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #fff0c2;
  color: #f59b12;
  font-style: normal;
  font-size: 10px;
  line-height: 1.2;
  vertical-align: 1px;
}

.logout-button {
  display: grid;
  place-items: center;
  height: 40px;
  margin-top: 28px;
  border: 1px solid #ffcdcd;
  border-radius: 999px;
  background: #fff1f1;
  color: #f04444;
  font-size: 14px;
  font-weight: 600;
}
</style>
