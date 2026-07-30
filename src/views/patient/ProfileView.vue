<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { PatientProfile } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
// 就诊卡号由患者自行填写（可选）。不能预置统一的 mock 值：
// 卡号会随快照落库，所有人相同会导致医生端按卡号判重/匹配时张冠李戴
const form = reactive<PatientProfile>({ ...store.profile })

async function next() {
  if (!form.name || !form.gender || !form.age || !form.phone) {
    showToast('请完善姓名、性别、年龄和手机号')
    return
  }

  await store.saveProfile({ ...form })
  await store.loadQuestions()
  router.push('/consultation')
}
</script>

<template>
  <div class="page">
    <AppNavBar title="基本信息" back />
    <main class="page-body">
      <van-form class="surface form-panel">
        <van-field v-model="form.name" label="姓名" placeholder="请输入姓名" />
        <van-field label="性别">
          <template #input>
            <van-radio-group v-model="form.gender" direction="horizontal">
              <van-radio name="male">男</van-radio>
              <van-radio name="female">女</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          :model-value="form.age ?? undefined"
          type="digit"
          label="年龄"
          placeholder="请输入年龄"
          @update:model-value="(val) => (form.age = val ? Number(val) : null)"
        />
        <van-field v-model="form.phone" type="tel" label="手机号" placeholder="请输入手机号" />
        <van-field v-model="form.idCard" label="身份证号" placeholder="可选" />
        <van-field v-model="form.cardNo" label="就诊卡号" placeholder="可选" />
      </van-form>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block @click="next">进入问诊</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-panel {
  overflow: hidden;
}
</style>
