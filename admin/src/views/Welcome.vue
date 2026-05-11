<template>
  <div class="welcome-container">
    <!-- Top Navigation -->
    <header class="welcome-header">
      <div class="logo">
        <img src="@/assets/logo.png" class="logo-img" alt="logo" />
        <span class="logo-text">A-Track</span>
      </div>
      <div class="header-actions">
        <!-- Theme Toggle -->
        <button class="action-btn" @click="toggleTheme" title="切换主题">
          <el-icon :size="20"><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
        </button>
        <button class="ghost-btn" @click="handleEnterSystem(false)">快速体验</button>
        <button class="primary-btn" @click="handleEnterSystem(true)">登录控制台</button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="welcome-main">
      <div class="hero-section">
        <div class="badge fade-in-up" style="animation-delay: 0.1s;">
          <span class="badge-dot"></span> Next-gen AI Management Engine
        </div>
        <h1 class="hero-title fade-in-up" style="animation-delay: 0.2s;">
          重塑 AI 教育与管理的 <br>
          <span class="text-gradient">未来引擎</span>
        </h1>
        <p class="hero-subtitle fade-in-up" style="animation-delay: 0.3s;">
          基于先进驱动架构，为您提供全景数据洞察、智能化策略配置与繁荣社区生态管控的一站式解决方案。
        </p>

        <!-- Dynamic Jumping Data -->
        <div class="hero-stats fade-in-up" style="animation-delay: 0.35s;">
          <div class="stat-item">
            <div class="stat-num">{{ userCount.toLocaleString() }}<span class="plus">+</span></div>
            <div class="stat-label">注册用户</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-num">{{ requestCount.toLocaleString() }}<span class="plus">+</span></div>
            <div class="stat-label">日均请求</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-num">{{ modelCalls.toLocaleString() }}<span class="plus">+</span></div>
            <div class="stat-label">模型运算</div>
          </div>
        </div>

        <div class="hero-actions fade-in-up" style="animation-delay: 0.4s;">
          <button class="cta-primary" @click="handleEnterSystem(true)">
            立即进入系统 <el-icon class="action-icon"><ArrowRight /></el-icon>
          </button>
        </div>
      </div>

      <!-- Feature Cards -->
      <div class="features-grid">
        <div class="feature-card fade-in-up" style="animation-delay: 0.6s;">
          <div class="feature-icon-wrapper blue">
            <el-icon><DataAnalysis /></el-icon>
          </div>
          <h3>全局数据洞察</h3>
          <p>实时监控多维学习数据，深度剖析用户行为，通过可视化大屏精准把握平台动态。</p>
        </div>

        <div class="feature-card fade-in-up" style="animation-delay: 0.8s;">
          <div class="feature-icon-wrapper purple">
            <el-icon><Connection /></el-icon>
          </div>
          <h3>动态策略引擎</h3>
          <p>灵活配置学科知识图谱与练习策略，自适应推荐引擎毫秒级响应用户个性需求。</p>
        </div>

        <div class="feature-card fade-in-up" style="animation-delay: 1.0s;">
          <div class="feature-icon-wrapper pink">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <h3>智能社区管控</h3>
          <p>智能过滤垃圾信息并监控舆情动向，赋予管理者删帖、用户警告与状态封禁能力。</p>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="welcome-footer">
      <p>&copy; 2026 A-Track Platform. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, DataAnalysis, Connection, ChatDotRound, Moon, Sunny } from '@element-plus/icons-vue'

const router = useRouter()

const isDark = ref(false)

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

const handleEnterSystem = (forceLogin = false) => {
  const isLoggedIn = sessionStorage.getItem('admin_logged_in')
  if (isLoggedIn && !forceLogin) {
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
}

// === Jumping Data State ===
const userCount = ref(0)
const requestCount = ref(0)
const modelCalls = ref(0)

const animateValue = (refVar, start, end, duration) => {
  let startTimestamp = null
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp
    const progress = Math.min((timestamp - startTimestamp) / duration, 1)
    // easeOutExpo for smooth deceleration
    const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    refVar.value = Math.floor(easeOut * (end - start) + start)
    if (progress < 1) {
      window.requestAnimationFrame(step)
    }
  }
  window.requestAnimationFrame(step)
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  
  // 1. Start Jumping Data Animation
  setTimeout(() => {
    animateValue(userCount, 0, 12845, 2500)
    animateValue(requestCount, 0, 894562, 3000)
    animateValue(modelCalls, 0, 3450, 2500)
  }, 800)
})
</script>

<style scoped>
/* Base Styles */
.welcome-container {
  min-height: 100vh;
  width: 100%;
  background-color: transparent;
  color: var(--text-primary);
  position: relative;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}



/* Header - Liquid Glass */
.welcome-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 4rem;
  backdrop-filter: blur(28px);
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  background: transparent;
  transition: all var(--duration-fast) var(--ease-out-quart);
  border: none;
}

.action-btn:hover {
  background: var(--bg-base);
  color: var(--primary);
}

button {
  cursor: pointer;
  border: none;
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-out-quart);
  font-family: inherit;
}

.ghost-btn {
  background: transparent;
  color: var(--text-secondary);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-sm);
}

.ghost-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.primary-btn {
  background: var(--primary-bg);
  color: var(--text-primary);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  backdrop-filter: blur(12px);
}

.primary-btn:hover {
  background: var(--primary);
  color: #fff;
  box-shadow: var(--shadow-md);
}

/* Main Content */
.welcome-main {
  flex: 1;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.hero-section {
  text-align: center;
  max-width: 800px;
  margin-top: 2rem;
  margin-bottom: 6rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--primary-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  color: var(--primary-light);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}

.badge-dot {
  width: 8px;
  height: 8px;
  background-color: var(--primary);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 var(--primary-bg); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.hero-title {
  font-size: clamp(2.5rem, 5vw + 1rem, 4rem);
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.text-gradient {
  background: linear-gradient(135deg, var(--info), var(--primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* Jumping Data Stats - Intense Liquid Glass */
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  margin-bottom: 3rem;
  background: var(--bg-card);
  padding: 1.5rem 3rem;
  border-radius: var(--radius-xl);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xl);
  position: relative;
  z-index: 20;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.stat-num {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  display: flex;
  align-items: baseline;
}

.stat-num .plus {
  font-size: 1.5rem;
  color: var(--primary);
  margin-left: 4px;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--border);
}

.cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
  padding: 1rem 2.5rem;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--ease-out-quart);
  box-shadow: var(--shadow-md);
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
}

.action-icon {
  transition: transform var(--duration-fast) var(--ease-out-quart);
}

.cta-primary:hover .action-icon {
  transform: translateX(4px);
}

/* Feature Cards - Liquid Glass Effect */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  width: 100%;
}

.feature-card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: all var(--duration-normal) var(--ease-out-quart);
  box-shadow: var(--shadow-md);
}

.feature-card:hover {
  transform: translateY(-5px);
  background: color-mix(in srgb, var(--bg-card), var(--primary) 5%);
  border-color: var(--primary-light);
  box-shadow: var(--shadow-lg);
}

.feature-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.feature-icon-wrapper.blue {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  color: var(--info);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--info) 30%, transparent);
}

.feature-icon-wrapper.purple {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent);
}

.feature-icon-wrapper.pink {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 30%, transparent);
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.feature-card p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 0.95rem;
}

/* Footer */
.welcome-footer {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  border-top: 1px solid var(--border);
}

/* Animations */
.fade-in-up {
  opacity: 0;
  animation: fadeInUp var(--duration-slow) forwards var(--ease-out-quart);
}

@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .welcome-header {
    padding: 1rem 1.5rem;
  }
  
  .hero-stats {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .stat-divider {
    width: 60%;
    height: 1px;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
