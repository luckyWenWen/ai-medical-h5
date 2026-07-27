<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'

const router = useRouter()
const selected = ref('')
const parts = ['头部', '胸部', '腹部', '背部', '上肢', '下肢']

function confirm() {
  if (!selected.value) {
    showToast('请选择部位')
    return
  }

  router.back()
}
</script>

<template>
  <div class="page">
    <AppNavBar title="部位选择" back />
    <main class="page-body">
      <section class="body-map surface">
        <div class="body-map__figure">
          <button
            v-for="part in parts"
            :key="part"
            type="button"
            class="body-map__part"
            :class="{ 'body-map__part--active': selected === part }"
            @click="selected = part"
          >
            {{ part }}
          </button>
        </div>
      </section>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner action-row">
        <van-button plain type="primary" @click="router.back()">不清楚</van-button>
        <van-button type="primary" @click="confirm">确定</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body-map {
  padding: 20px;
}

.body-map__figure {
  position: relative;
  width: min(230px, 80vw);
  height: 480px;
  margin: 0 auto;
  border-radius: 120px 120px 70px 70px;
  background: linear-gradient(180deg, var(--theme-primary-muted), var(--theme-primary-soft));
  border: 1px solid var(--theme-border);
}

.body-map__part {
  position: absolute;
  left: 50%;
  width: 92px;
  min-height: 36px;
  transform: translateX(-50%);
  border: 1px solid var(--theme-primary);
  border-radius: 8px;
  background: var(--theme-surface);
  color: var(--theme-primary);
}

.body-map__part:nth-child(1) {
  top: 34px;
}

.body-map__part:nth-child(2) {
  top: 130px;
}

.body-map__part:nth-child(3) {
  top: 214px;
}

.body-map__part:nth-child(4) {
  top: 300px;
}

.body-map__part:nth-child(5) {
  top: 166px;
  left: 19%;
}

.body-map__part:nth-child(6) {
  top: 390px;
}

.body-map__part--active {
  background: var(--theme-primary);
  color: var(--theme-on-primary);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
