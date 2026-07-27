# 智能预问诊患者端 H5

基于 `需求.md` 搭建的患者端移动 H5 框架，技术栈为 Vue 3、Vite、TypeScript、Vant 4、Pinia、Vue Router、Axios，预留微信 JS-SDK 接入点。

## 运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

当前机器未识别到 `node`/`npm`，因此本次未能在本机完成依赖安装和构建验证。

## 目录

```text
src/
  api/            接口请求与后端对接
  components/     移动端通用组件
  mock/           本地问诊问题与症状数据
  router/         患者端页面路由
  stores/         Pinia 状态与断点续问缓存
  styles/         全局主题和移动端样式
  types/          业务类型定义
  utils/          微信等平台能力封装
  views/patient/  患者端页面
```

## 已搭建页面

- `/` 入口页
- `/visit` 就诊信息
- `/profile` 基本信息
- `/consultation` 聊天式智能问诊
- `/body` 部位选择
- `/upload` 上传资料
- `/report` 报告确认
- `/success` 提交成功

## 后端对接点

- `src/api/request.ts`：Axios 实例，读取 `VITE_API_BASE_URL` 和本地 `patient_token`
- `src/api/consultation.ts`：问诊问题加载与报告生成，目前使用本地 mock，后续替换为真实接口即可
- `src/stores/consultation.ts`：患者信息、问答、上传资料、报告、问诊编号与断点续问缓存

## 主题切换

直接修改 `src/styles/theme.css` 顶部的 `--theme-*` 变量即可切换整套色系。页面、按钮、导航栏、提示条都已经复用这一层变量。
