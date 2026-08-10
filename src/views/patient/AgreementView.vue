<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isPrivacy = computed(() => route.name === 'privacy-agreement')
const title = computed(() => (isPrivacy.value ? '隐私协议' : '服务协议'))
</script>

<template>
  <div class="agreement-page">
    <van-nav-bar
      class="safe-top"
      :title="title"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <main class="agreement-content">
      <h1>{{ title }}</h1>
      <p class="agreement-updated">更新日期：2026年8月10日</p>

      <template v-if="isPrivacy">
        <h2>一、我们如何收集信息</h2>
        <p>为了向您提供智能预问诊服务，我们可能收集您的手机号、验证码、姓名、性别、年龄、就诊信息、症状描述及您主动上传的检查资料。</p>
        <h2>二、我们如何使用信息</h2>
        <p>我们仅在提供预问诊、生成就诊前信息摘要、改善服务及保障系统安全所必需的范围内使用相关信息，不会将您的信息用于与本服务无关的用途。</p>
        <h2>三、信息的保存与保护</h2>
        <p>我们会采取合理的安全措施保护您的个人信息，并按照法律法规及业务所需期限保存。您可以通过产品页面或联系客服了解、更正相关信息。</p>
        <h2>四、第三方服务</h2>
        <p>当您使用微信、支付宝等第三方登录或服务时，相关信息处理将同时遵循第三方平台的隐私规则。</p>
        <h2>五、联系我们</h2>
        <p>如果您对个人信息处理有任何疑问、意见或建议，请通过医院或本服务提供的客服渠道与我们联系。</p>
      </template>
      <template v-else>
        <h2>一、服务说明</h2>
        <p>智能预问诊用于就诊前收集和整理健康信息，帮助医务人员更高效地了解您的情况。本服务不能替代医生面诊、检查或诊断。</p>
        <h2>二、用户使用规范</h2>
        <p>您应当使用本人真实、准确的信息，不得冒用他人身份，不得提交虚假、违法或侵害他人权益的内容。</p>
        <h2>三、医疗风险提示</h2>
        <p>系统生成的内容仅供就诊沟通参考。如出现急性胸痛、呼吸困难、意识障碍、大出血等紧急情况，请立即前往急诊或拨打急救电话。</p>
        <h2>四、服务变更与中断</h2>
        <p>因系统维护、网络故障或不可抗力导致服务暂时中断时，我们会尽力恢复服务，但不对超出合理控制范围的中断承担责任。</p>
        <h2>五、协议生效</h2>
        <p>当您勾选同意并使用本服务时，即表示您已阅读、理解并同意本协议及相关隐私规则。</p>
      </template>
    </main>
  </div>
</template>

<style scoped>
.agreement-page {
  min-height: 100vh;
  background: #fff;
}

.agreement-content {
  width: min(100%, 620px);
  margin: 0 auto;
  padding: 22px 20px calc(32px + env(safe-area-inset-bottom));
}

.agreement-content h1 {
  margin: 0;
  color: #202b3f;
  font-size: 21px;
  line-height: 1.4;
}

.agreement-updated {
  margin: 8px 0 26px;
  color: #a5afbe;
  font-size: 12px;
}

.agreement-content h2 {
  margin: 22px 0 9px;
  color: #26344a;
  font-size: 15px;
  line-height: 1.5;
}

.agreement-content p {
  margin: 0;
  color: #617084;
  font-size: 13px;
  line-height: 1.9;
  text-align: justify;
}
</style>
