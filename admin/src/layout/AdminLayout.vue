<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar" :class="{ collapsed: isCollapsed }">
      <div class="sidebar-logo" :style="isCollapsed ? 'justify-content: center; padding: 0;' : 'justify-content: space-between; padding: 0 16px;'">
        <img v-show="!isCollapsed" src="@/assets/logo.png" class="logo-img" alt="logo" style="width: 28px; height: 28px;" />
        <span v-show="!isCollapsed" class="logo-text" style="font-size: 15px; white-space: nowrap; flex: 1; text-align: center;">智辙管理后台</span>
        <div class="sidebar-collapse-btn-inline" @click="isCollapsed = !isCollapsed" title="展开/收起侧边栏">
          <el-icon :size="24">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
        </div>
      </div>
      <div class="sidebar-menu">
        <el-menu
          :default-active="$route.path"
          router
          :collapse="isCollapsed"
          :collapse-transition="false"
          background-color="transparent"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <template #title><span>数据概览</span></template>
          </el-menu-item>
          <el-menu-item index="/users">
            <el-icon><User /></el-icon>
            <template #title><span>用户管理</span></template>
          </el-menu-item>
          <el-menu-item index="/subjects">
            <el-icon><Reading /></el-icon>
            <template #title><span>学科管理</span></template>
          </el-menu-item>
          <el-menu-item index="/learning-analytics">
            <el-icon><TrendCharts /></el-icon>
            <template #title><span>学习数据分析</span></template>
          </el-menu-item>
          <el-menu-item index="/community">
            <el-icon><ChatDotRound /></el-icon>
            <template #title><span>社区管理</span></template>
          </el-menu-item>
          <el-menu-item index="/system">
            <el-icon><Setting /></el-icon>
            <template #title><span>系统设置</span></template>
          </el-menu-item>
        </el-menu>
      </div>
      <!-- 底部动作栏 -->
      <div id="admin-notice-container" class="admin-notice-slot"></div>
      
      <div class="sidebar-footer">
        <div class="sidebar-actions" :class="{ 'is-collapsed': isCollapsed }">
          <div class="notice-wrapper" v-show="!isCollapsed">
            <NoticeIcon />
          </div>
          <div class="logout-btn" @click="handleLogout" title="退出登录">
            <el-icon :size="20"><SwitchButton /></el-icon>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容 -->
    <div class="admin-main" :class="{ 'sidebar-collapsed': isCollapsed }">
      <!-- 顶部栏 -->
      <header class="admin-header">
        <div class="header-left">
          <el-breadcrumb separator="/" v-show="isCollapsed">
            <el-breadcrumb-item>{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <!-- Dark Mode Toggle -->
          <div class="action-btn" @click="toggleTheme" title="切换主题">
            <el-icon :size="20"><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
          </div>
        </div>
      </header>

      <!-- 路由内容 -->
      <div class="page-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <el-skeleton v-if="isPageLoading" :loading="true" animated class="page-skeleton">
              <template #template>
                <div style="padding: 24px;">
                  <el-skeleton-item variant="h1" style="width: 250px; height: 32px; margin-bottom: 24px;" />
                  <el-row :gutter="20" style="margin-bottom: 24px;">
                    <el-col :span="6" v-for="i in 4" :key="i">
                      <el-skeleton-item variant="rect" style="height: 120px; border-radius: var(--radius-lg, 12px);" />
                    </el-col>
                  </el-row>
                  <el-skeleton-item variant="rect" style="width: 100%; height: 400px; border-radius: var(--radius-lg, 12px);" />
                </div>
              </template>
            </el-skeleton>
            <component v-else :is="Component" :key="$route.path" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Moon, Sunny, DataAnalysis, User, Reading, TrendCharts, ChatDotRound, Setting, SwitchButton, Fold, Expand } from '@element-plus/icons-vue'
import NoticeIcon from '../components/NoticeIcon.vue'
import NProgress from 'nprogress'

const router = useRouter()
const route = useRoute()

const icons = {
  DataAnalysis,
  User,
  Reading,
  TrendCharts,
  ChatDotRound,
  Setting
}
const isCollapsed = ref(false)
const isDark = ref(false)
const isPageLoading = ref(false)

watch(() => route.path, () => {
  isPageLoading.value = true
  NProgress.start()
  setTimeout(() => {
    isPageLoading.value = false
    NProgress.done()
  }, 800)
})

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  isPageLoading.value = true
  // Let the router's beforeEach handle the initial NProgress.start() if it triggered it
  setTimeout(() => {
    isPageLoading.value = false
    NProgress.done()
  }, 800)
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

function handleLogout() {
  sessionStorage.removeItem('admin_logged_in')
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar-collapse-btn-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-quart);
  flex-shrink: 0;
}

.sidebar-collapse-btn-inline:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--primary);
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all var(--duration-normal) var(--ease-out-quart);
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-15px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(15px);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.action-btn:hover {
  background: var(--bg-base);
  color: var(--primary);
}

.badge-item {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-footer {
  padding: 10px;
  border-top: none;
  flex: none;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  width: 100%;
  padding: 8px 0;
}

.notice-wrapper {
  width: 100%;
}

.notice-wrapper :deep(.action-btn) {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  background: rgba(64, 158, 255, 0.1);
  color: var(--el-color-primary, #409eff);
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.notice-wrapper :deep(.action-btn:hover) {
  background: rgba(64, 158, 255, 0.2);
  transform: translateY(-2px);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  border-radius: 12px;
  background: rgba(245, 108, 108, 0.1);
  color: var(--el-color-danger, #f56c6c);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.logout-btn:hover {
  background: rgba(245, 108, 108, 0.2);
  transform: translateY(-2px);
}

.sidebar-menu {
  padding: 12px 8px;
  flex: 0 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
}

.admin-sidebar.collapsed .sidebar-menu {
  padding: 12px 0;
}

.admin-notice-slot {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.sidebar-menu :deep(.el-menu) {
  border-right: none;
}

.sidebar-menu :deep(.el-menu-item) {
  margin-bottom: 8px;
  border-radius: 12px;
  height: 50px;
  line-height: 50px;
}

.sidebar-menu :deep(.el-menu-item:last-child) {
  margin-bottom: 0;
}
</style>
