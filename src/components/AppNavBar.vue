<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  title: string
  back?: boolean
  help?: boolean
}>()

const router = useRouter()
</script>

<template>
  <van-nav-bar
    class="safe-top"
    :title="title"
    :left-arrow="back"
    fixed
    :zIndex="9999"
    placeholder
    @click-left="router.back()"
  >
    <template #right>
      <van-icon v-if="help" name="question-o" size="18" />
    </template>
  </van-nav-bar>
</template>
