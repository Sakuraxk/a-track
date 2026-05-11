import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// NProgress Configuration
NProgress.configure({ showSpinner: false, minimum: 0.1, speed: 500 })


const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录 - 智辙后台管理系统' }
  },
  {
    path: '/',
    component: () => import('../layout/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '数据概览', icon: 'DataAnalysis' }
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: () => import('../views/UserManagement.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'users/:id',
        name: 'UserDetail',
        component: () => import('../views/UserDetail.vue'),
        meta: { title: '用户详情', icon: 'User', hidden: true }
      },
      {
        path: 'subjects',
        name: 'SubjectManagement',
        component: () => import('../views/SubjectManagement.vue'),
        meta: { title: '学科管理', icon: 'Reading' }
      },
      {
        path: 'learning-analytics',
        name: 'LearningAnalytics',
        component: () => import('../views/LearningAnalytics.vue'),
        meta: { title: '学习数据分析', icon: 'TrendCharts' }
      },
      {
        path: 'community',
        name: 'CommunityManagement',
        component: () => import('../views/CommunityManagement.vue'),
        meta: { title: '社区管理', icon: 'ChatDotRound' }
      },
      {
        path: 'system',
        name: 'SystemSettings',
        component: () => import('../views/SystemSettings.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory('/admin/'),  // ← 关键！设置 base 路径
  routes
})

router.beforeEach((to, from, next) => {
  NProgress.start()
  document.title = to.meta.title || '智辙后台管理系统'
  const isLoggedIn = sessionStorage.getItem('admin_logged_in')

  if (to.path !== '/login' && !isLoggedIn) {
    next('/login')
  } else {
    next()
  }
})

router.afterEach((to) => {
  // If it's a route with the admin layout, we let AdminLayout.vue handle NProgress.done()
  // so it can sync with the skeleton screen.
  if (to.path === '/login') {
    NProgress.done()
  }
})

export default router
