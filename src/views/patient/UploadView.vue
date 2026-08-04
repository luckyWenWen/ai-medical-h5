<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showImagePreview } from 'vant'
import { uploadAttachmentApi } from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { UploadMaterial } from '@/types/consultation'

interface VantFile {
  file?: File
  content?: string
  url?: string
  message?: string
}

const router = useRouter()
const store = useConsultationStore()
const fileList = ref<VantFile[]>([])
const submitting = ref(false)

const question = computed(() => store.currentQuestion)
const hasMaterials = computed(() => store.materials.length > 0)
const uploadedMaterials = computed(() =>
  store.materials.filter((material) => material.status === 'uploaded')
)
const maxFiles = computed(() => question.value?.maxFiles || 9)
const maxFileSizeBytes = computed(() => question.value?.maxFileSizeBytes || 10 * 1024 * 1024)
const accept = computed(() => question.value?.acceptedMimeTypes?.join(',') || 'image/*,.pdf')

onMounted(() => {
  if (question.value?.type !== 'upload') {
    router.replace('/consultation')
    return
  }

  // 恢复已有的上传列表到 van-uploader 缩略图视图
  fileList.value = store.materials.map((m) => ({
    url: m.url || '',
    name: m.name,
    isImage: m.type === 'image'
  }))
})

function onUploaderDelete(_file: VantFile, detail: { index: number }) {
  if (detail && typeof detail.index === 'number' && store.materials[detail.index]) {
    const target = store.materials[detail.index]
    store.removeMaterial(target.id)
    showToast(`已移除 ${target.name}`)
  }
}

function deleteMaterial(id: string) {
  const index = store.materials.findIndex((m) => m.id === id)
  if (index >= 0) {
    const target = store.materials[index]
    store.removeMaterial(id)
    fileList.value = fileList.value.filter((_, i) => i !== index)
    showToast(`已删除 ${target.name}`)
  }
}

function previewMaterial(item: UploadMaterial) {
  if (item.type === 'image' && item.url) {
    showImagePreview({
      images: [item.url],
      closeable: true,
      closeOnClickOverlay: true,
      closeOnClickImage: true
    })
  } else if (item.name) {
    showToast(`文件：${item.name}`)
  }
}

async function afterRead(item: VantFile | VantFile[]) {
  const files = Array.isArray(item) ? item : [item]
  const currentQuestion = question.value

  if (!store.recordId || !currentQuestion || currentQuestion.type !== 'upload') {
    showToast('问诊记录尚未就绪，暂时无法上传')
    return
  }

  for (const fileItem of files) {
    const file = fileItem.file
    if (!file) continue

    if (store.materials.length >= maxFiles.value) {
      showToast(`最多上传 ${maxFiles.value} 份资料`)
      break
    }
    if (file.size > maxFileSizeBytes.value) {
      showToast(`单个文件不能超过 ${Math.ceil(maxFileSizeBytes.value / 1024 / 1024)}MB`)
      continue
    }

    const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
    let attachmentId = localId
    let uploadStatus: 'local' | 'uploaded' = 'local'

    try {
      const response = await uploadAttachmentApi(store.recordId, currentQuestion.id, file)
      const backendId = String(response?.attachmentId || response?.id || '')
      if (!backendId) {
        throw new Error('附件上传接口未返回 attachmentId')
      }
      attachmentId = backendId
      uploadStatus = 'uploaded'
    } catch (error) {
      console.warn('上传附件到后端接口失败:', error)
      showToast(`${file.name} 上传失败，请重试`)
    }

    store.addMaterial({
      id: attachmentId,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url: fileItem.content || fileItem.url || '',
      status: uploadStatus
    })
  }
}

async function finishUpload() {
  if (submitting.value) return
  submitting.value = true
  try {
    const attachmentIds = uploadedMaterials.value.map((material) => material.id)
    if (!attachmentIds.length && hasMaterials.value) {
      showToast('没有上传成功的资料，本题将按未上传处理')
    }

    await store.answerCurrent(attachmentIds.length ? attachmentIds : null)
    if (!store.currentQuestion) {
      const reportReady = await store.buildReport()
      if (!reportReady) return
      await router.replace('/report')
      return
    }
    await router.replace('/consultation')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppNavBar title="上传资料" back />
    <main class="page-body">
      <section class="surface upload-panel">
        <p class="upload-panel__tip">
          可上传检查报告、检验单或患处照片。请勿上传与本次就诊无关的隐私资料。
        </p>
        <van-uploader
          v-model="fileList"
          multiple
          :max-count="maxFiles"
          :after-read="afterRead"
          @delete="onUploaderDelete"
          :accept="accept"
        />
      </section>

      <div class="section-header">
        <p class="section-title">已选择资料（{{ store.materials.length }} 份）</p>
      </div>
      <van-empty v-if="!hasMaterials" description="暂无资料，可直接跳过" />
      <div v-else class="materials-list">
        <van-cell
          v-for="item in store.materials"
          :key="item.id"
          :title="item.name"
          :label="item.status === 'uploaded' ? (item.type === 'image' ? '点击预览图片' : '已上传成功') : '上传失败，未提交'"
          is-link
          @click="previewMaterial(item)"
        >
          <template #value>
            <div class="cell-action-group" @click.stop>
              <van-tag :type="item.status === 'uploaded' ? 'success' : 'danger'">
                {{ item.type === 'image' ? '图片' : '文件' }}
              </van-tag>
              <van-button
                size="small"
                type="danger"
                plain
                class="delete-btn"
                @click="deleteMaterial(item.id)"
              >
                删除
              </van-button>
            </div>
          </template>
        </van-cell>
      </div>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" @click="finishUpload">
          {{ uploadedMaterials.length ? '完成上传' : '暂不上传' }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-panel {
  padding: 14px;
}

.upload-panel__tip {
  margin: 0 0 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 8px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text-secondary);
}

.materials-list {
  border-radius: var(--theme-radius);
  overflow: hidden;
}

.cell-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 4px;
}
</style>
