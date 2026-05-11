import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// 强制默认使用深色科技主题 (大屏效果)
const savedTheme = localStorage.getItem('atrack_theme')
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark')
} else {
  document.documentElement.classList.add('dark')
}

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
