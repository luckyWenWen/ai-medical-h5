<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'

interface VantFile {
  file?: File
  content?: string
}

const router = useRouter()
const store = useConsultationStore()
const fileList = ref<VantFile[]>([])
const hasMaterials = computed(() => store.materials.length > 0)

import { uploadAttachmentApi } from '@/api/consultation'

async function afterRead(item: VantFile | VantFile[]) {
  const files = Array.isArray(item) ? item : [item]

  for (const fileItem of files) {
    const file = fileItem.file

    if (!file) continue

    if (file.size > 10 * 1024 * 1024) {
      showToast('单个文件不能超过 10MB')
      continue
    }

    let remoteUrl = fileItem.content || ''
    if (store.recordId) {
      try {
        const res = await uploadAttachmentApi(store.recordId, file)
        if (res && res.url) {
          remoteUrl = res.url
        }
      } catch (error) {
        console.warn('上传附件到后端接口失败，保留本地模式:', error)
      }
    }

    store.addMaterial({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url: remoteUrl,
      status: 'uploaded'
    })
  }
}

function finishUpload() {
  if (!hasMaterials.value) {
    store.answerCurrent(null)
  } else {
    store.answerCurrent(`已上传 ${store.materials.length} 份资料`)
  }

  if (!store.currentQuestion) {
    store.buildReport().then(() => router.push('/report'))
    return
  }

  router.push('/consultation')
}
</script>

<template>
  <div class="page">
    <AppNavBar title="上传资料" back />
    <main class="page-body">
      <section class="surface upload-panel">
        <van-uploader
          v-model="fileList"
          multiple
          :max-count="9"
          :after-read="afterRead"
          accept="image/*,.pdf"
        />
      </section>

      <p class="section-title">已上传资料</p>
      <van-empty v-if="!hasMaterials" description="暂无资料" />
      <van-swipe-cell v-for="item in store.materials" :key="item.id">
        <van-cell :title="item.name" :label="item.type === 'image' ? '图片资料' : '文件资料'" />
        <template #right>
          <van-button square type="danger" text="删除" @click="store.removeMaterial(item.id)" />
        </template>
      </van-swipe-cell>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block @click="finishUpload">完成</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-panel {
  padding: 14px;
}
</style>
