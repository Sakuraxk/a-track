<template>
  <div class="login-page">
    <!-- Theme Toggle -->
    <div class="theme-toggle animate-in">
      <button class="action-btn" @click="toggleTheme" title="切换主题">
        <el-icon :size="20"><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
      </button>
    </div>
    <div class="login-card animate-in">
      <div class="login-logo">
        <img src="@/assets/logo.png" class="login-logo-img" alt="logo" />
        <div class="login-title">智辙后台管理系统</div>
        <div class="login-subtitle">A-Track AI 自适应学习平台 · 管理端</div>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入管理员账号"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.remember">记住登录状态</el-checkbox>
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          style="width: 100%; height: 44px; font-size: 15px; font-weight: 600;"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Moon, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const isDark = ref(false)

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('atrack_theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('atrack_theme', 'light')
  }
}

const form = ref({
  username: 'admin',
  password: 'admin123',
  remember: true
})

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  loading.value = true
  // 模拟登录延迟
  await new Promise(r => setTimeout(r, 800))
  
  if (form.value.username === 'admin' && form.value.password === 'admin123') {
    sessionStorage.setItem('admin_logged_in', 'true')
    ElMessage.success('登录成功，欢迎回来！')
    router.push('/dashboard')
  } else {
    ElMessage.error('账号或密码错误')
  }
  loading.value = false
}
</script>

<style scoped>
.theme-toggle {
  position: absolute;
  top: 40px;
  right: 40px;
  z-index: 10;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  background: var(--bg-card);
  transition: all var(--duration-fast) var(--ease-out-quart);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.action-btn:hover {
  background: color-mix(in srgb, var(--bg-card), var(--primary) 5%);
  color: var(--primary);
  border-color: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
</style>
