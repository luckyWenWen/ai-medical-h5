<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useConsultationStore } from '@/stores/consultation'
import stepOneImage from '@/assets/image/1.png'
import stepTwoImage from '@/assets/image/2.png'
import stepThreeImage from '@/assets/image/3.png'
import hosiptalImg from '@/assets/image/5.png'

const router = useRouter()
const store = useConsultationStore()
const stepItems = [
  {
    image: stepOneImage,
    label: '1填写信息'
  },
  {
    image: stepTwoImage,
    label: '2.智能问答'
  },
  {
    image: stepThreeImage,
    label: '3.生成报告'
  }
]

const tabItems = [
  { icon: 'wap-home-o', label: '首页', active: true },
  { icon: 'underway-o', label: '历史' },
  { icon: 'add-square', label: '服务' },
  { icon: 'setting-o', label: '设置' }
]
</script>

<template>
  <div class="page home-page">
    <header class="hero">
      <nav class="hero-nav safe-top">
        <div class="hero-nav__brand">
          <!-- <van-icon name="plus" /> -->
          <span>智能预问诊</span>
        </div>
        <!-- <van-icon name="manager-o" /> -->
         <van-icon  name="question-o" size="18" />
      </nav>

      <section class="brand">
        <div class="brand__photo" aria-hidden="true">
          <!-- <div class="brand__sky"></div>
          <div class="brand__building brand__building--main"></div>
          <div class="brand__building brand__building--side"></div>
          <div class="brand__lawn"></div> -->
          <img :src="hosiptalImg" alt="医院" />
        </div>
        <h1>长沙市中西结合医院</h1>
        <p>智慧医疗服务</p>
      </section>
    </header>

    <main class="home page-body">
      <section class="intro surface-soft">
        <div class="intro__title">
          <van-icon name="info-o" />
          <h2>什么是智能预问诊？</h2>
        </div>
        <p>
          就诊前，通过简单的问答提前采集您的症状和病史信息，帮助医生更快地了解您的情况，节省就诊时间。
        </p>
      </section>

      <section class="steps surface">
        <template v-for="(item, index) in stepItems" :key="item.label">
          <div class="step-item">
            <img :src="item.image" :alt="item.label" />
            <strong>{{ item.label }}</strong>
          </div>
          <i v-if="index < stepItems.length - 1" aria-hidden="true"></i>
        </template>
      </section>

      <section class="alert">
        <van-icon name="shield-o" />
        <p>本系统仅用于就诊前信息采集，不替代医生诊断。如有紧急情况请立即前往急诊科。</p>
      </section>

      <div class="fixed-action home-actions">
        <div class="fixed-action__inner action-stack">
          <van-button
            v-if="store.canResume"
            class="start-button"
            type="primary"
            block
            @click="router.push('/consultation')"
          >
            继续上次问诊
          </van-button>
          <van-button class="start-button" type="primary" block @click="router.push('/visit')">
            <span>开始预问诊</span>
            <van-icon name="arrow" />
          </van-button>
          <!-- <p class="duration">预计用时 3-5 分钟</p> -->
        </div>
      </div>
    </main>

    <!-- <footer class="tabbar">
      <button
        v-for="item in tabItems"
        :key="item.label"
        class="tabbar__item"
        :class="{ 'tabbar__item--active': item.active }"
        type="button"
      >
        <span class="tabbar__icon">
          <van-icon :name="item.icon" />
        </span>
        <span>{{ item.label }}</span>
      </button>
    </footer> -->
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f8fc 0%, #ffffff 76%);
  padding-bottom: calc(78px + env(safe-area-inset-bottom));
}

.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, var(--theme-primary-deep) 0%, var(--theme-accent) 20%, var(--theme-surface) 100%);
  padding: 0 12px 28px;
  color: var(--theme-on-primary);
}


.hero-nav {
  position: relative;
  z-index: 1;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--theme-on-primary);
}

.hero-nav__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 800;
}

.hero-nav__brand .van-icon,
.hero-nav > .van-icon {
  font-size: 18px;
}

.hero-nav__brand .van-icon {
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 4px;
}

.home {
  position: relative;
  margin-top: -47px;
  padding-top: 0;
}

.brand {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 26px 12px 42px;
}

.brand__photo {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  overflow: hidden;
  border: 4px solid var(--theme-on-surface);
  border-radius: 14px;
  /* background: linear-gradient(180deg, #a8d8ff 0%, #dff0ff 52%, #6db1ff 100%);
  box-shadow: var(--theme-shadow-md); */
}

.brand__photo img{
  width: 100%;
  height: 100%;
}
/* .brand__photo::after {
  position: absolute;
  inset: 0;
  content: "";
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 10px;
} */

.brand__sky {
  position: absolute;
  top: 9px;
  left: 8px;
  width: 24px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
}

.brand__building {
  position: absolute;
  bottom: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #a7c9ee 100%);
  border: 1px solid rgba(52, 95, 152, 0.24);
}

.brand__building--main {
  left: 15px;
  width: 34px;
  height: 28px;
}

.brand__building--side {
  right: 10px;
  width: 18px;
  height: 20px;
}

.brand__lawn {
  position: absolute;
  right: -8px;
  bottom: 0;
  left: -8px;
  height: 28px;
  background: linear-gradient(145deg, #2f8cff 0%, #7ec3ff 62%, #d9ecff 100%);
  transform: skewY(-8deg);
}

.brand h1 {
  margin: 0;
  color: var(--theme-text-strong);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  font-family: cursive;
}

.brand p {
  margin: 7px 0 0;
  color: rgba(23, 35, 59, 0.78);
  font-size: 14px;
  font-weight: 600;
  font-family: cursive;
}

.intro {
  padding: 17px 16px;
  background: #f1f5ff;
  border-color: #e3ecff;
  box-shadow: none;
  margin-bottom: 26px;
  box-shadow: 0 8px 22px rgba(26, 44, 56, 0.08);
}

.intro__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--theme-text-strong);
}

.intro__title .van-icon {
  color: var(--theme-primary);
  font-size: 20px;
}

.intro h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.25;
}

.intro p {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 14px;
  line-height: 1.75;
}

.steps {
  display: grid;
  grid-template-columns: 1fr 34px 1fr 34px 1fr;
  align-items: center;
  margin: 0px 0 26px;
  padding: 18px 16px 15px;
  border-color: transparent;
  box-shadow: 0 8px 22px rgba(26, 44, 56, 0.08);
}

.step-item {
  min-width: 0;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
}

.step-item img {
  width: 44px;
  height: 44px;
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(0, 135, 121, 0.16));
}

.step-item strong {
  font-size: 13px;
  color: var(--theme-text-strong);
  white-space: nowrap;
}

.steps i {
  display: block;
  height: 2px;
  background: #bdd6ef;
}

.alert {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: flex-start;
  min-height: 74px;
  padding: 14px 15px;
  border: 1px solid var(--theme-alert-border);
  border-radius: var(--theme-radius);
  background: var(--theme-alert-bg);
  color: var(--theme-alert-text);
  box-shadow: none;
}

.alert .van-icon {
  margin-top: 2px;
  color: var(--theme-alert-icon);
  font-size: 18px;
}

.alert p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  font-weight: 600;
}

.action-stack {
  display: grid;
  gap: 10px;
}

.start-button {
  min-height: 50px;
  border: 0;
  font-size: 17px;
  font-weight: 700;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--theme-primary) 0%, var(--theme-primary-deep) 100%);
  box-shadow: 0 12px 18px rgba(0, 122, 112, 0.24);
}

.start-button :deep(.van-button__content) {
  gap: 8px;
}

.start-button :deep(.van-button__text),
.start-button :deep(.van-icon) {
  color: var(--theme-on-primary);
}

.home-actions {
  padding-right: 14px;
  padding-left: 14px;
}

.duration {
  margin: 0;
  color: var(--theme-text-muted);
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}

.tabbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: min(100%, 520px);
  min-height: calc(54px + env(safe-area-inset-bottom));
  margin: 0 auto;
  padding: 6px 14px calc(6px + env(safe-area-inset-bottom));
  border: 1px solid #c9d8ee;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: #eaf2ff;
}

.tabbar__item {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--theme-text-strong);
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;
}

.tabbar__icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--theme-text-strong);
  font-size: 17px;
}

.tabbar__item--active .tabbar__icon {
  width: 40px;
  height: 40px;
  margin-top: -12px;
  background: var(--theme-primary-deep);
  color: var(--theme-on-primary);
  font-size: 20px;
  box-shadow: 0 8px 18px rgba(0, 122, 112, 0.22);
}

.tabbar__item--active {
  color: var(--theme-primary-deep);
}
</style>
