<template>
  <div>
    <!-- 第一行：基础信息 & 系统状态 -->
    <el-row :gutter="24" style="margin-bottom: 24px; display: flex; align-items: stretch;">
      <el-col :xs="24" :lg="12" style="display: flex; flex-direction: column;">
        <div class="chart-card animate-in" style="flex: 1; margin-bottom: 0;">
          <div class="chart-title">平台基本信息</div>
          <el-form :model="systemForm" label-width="120px" label-position="right" style="max-width: 560px;">
            <el-form-item label="平台名称">
              <el-input v-model="systemForm.platformName" />
            </el-form-item>
            <el-form-item label="平台版本">
              <el-input v-model="systemForm.version" disabled />
            </el-form-item>
            <el-form-item label="管理员邮箱">
              <el-input v-model="systemForm.adminEmail" />
            </el-form-item>
            <el-form-item label="前端地址">
              <el-input v-model="systemForm.frontendUrl" disabled />
            </el-form-item>
            <el-form-item label="后端 API">
              <el-input v-model="systemForm.backendUrl" disabled />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSave">保存设置</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12" style="display: flex; flex-direction: column;">
        <!-- 系统状态 -->
        <div class="chart-card animate-in animate-in-delay-1" style="flex: 1; margin-bottom: 0;">
          <div class="chart-title">系统运行状态</div>
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div v-for="item in systemStatus" :key="item.label"
              style="display:flex; align-items:center; justify-content:space-between; padding: 10px 14px; background: var(--bg-base); border-radius: 8px;">
              <div style="display:flex; align-items:center; gap: 8px;">
                <span>{{ item.icon }}</span>
                <span style="font-size: 13px;">{{ item.label }}</span>
              </div>
              <el-tag :type="item.status === 'running' ? 'success' : 'danger'" size="small" effect="plain" round>
                {{ item.status === 'running' ? '运行中' : '已停止' }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 第二行：数据管理 & 快捷链接 -->
    <el-row :gutter="24" style="display: flex; align-items: stretch; margin-bottom: 24px;">
      <el-col :xs="24" :lg="12" style="display: flex; flex-direction: column;">
        <!-- 数据管理 -->
        <div class="chart-card animate-in animate-in-delay-3" style="flex: 1; margin-bottom: 0;">
          <div class="chart-title">🗃️ 数据管理</div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; background: var(--bg-base); border-radius: 8px;">
              <div>
                <div style="font-weight: 500;">导出用户数据</div>
                <div style="font-size: 12px; color: var(--text-secondary);">导出所有用户数据为 Excel 格式</div>
              </div>
              <el-button type="primary" size="small" :icon="Download" @click="handleExportUsers" style="font-weight: 600;">导出</el-button>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; background: var(--bg-base); border-radius: 8px;">
              <div>
                <div style="font-weight: 500;">导出学习数据</div>
                <div style="font-size: 12px; color: var(--text-secondary);">导出学习进度和统计数据</div>
              </div>
              <el-button type="primary" size="small" :icon="Download" @click="handleExportLearningData" style="font-weight: 600;">导出</el-button>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; background: rgba(239,68,68,0.04); border-radius: 8px; border: 1px solid rgba(239,68,68,0.1);">
              <div>
                <div style="font-weight: 500; color: var(--danger);">清除缓存</div>
                <div style="font-size: 12px; color: var(--text-secondary);">清除 Redis 缓存和临时文件</div>
              </div>
              <el-button type="danger" size="small" @click="handleClearCache" style="font-weight: 600;">清除</el-button>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12" style="display: flex; flex-direction: column;">
        <!-- 快捷链接 -->
        <div class="chart-card animate-in animate-in-delay-3" style="flex: 1; margin-bottom: 0;">
          <div class="chart-title">快捷链接</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a v-for="link in quickLinks" :key="link.url"
              :href="link.url" target="_blank" style="text-decoration: none;">
              <div style="display:flex; align-items:center; gap: 10px; padding: 10px 14px; background: var(--bg-base); border-radius: 8px; transition: background 0.2s; cursor:pointer;"
                @mouseenter="$event.target.style.background='var(--primary-bg)'"
                @mouseleave="$event.target.style.background='var(--bg-base)'">
                <span>{{ link.icon }}</span>
                <div style="flex:1;">
                  <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">{{ link.label }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">{{ link.url }}</div>
                </div>
                <el-icon style="color: var(--text-muted);"><Right /></el-icon>
              </div>
            </a>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const systemForm = ref({
  platformName: '智辙 A-Track',
  version: '1.0.0',
  adminEmail: 'admin@atrack.edu.cn',
  frontendUrl: 'http://localhost:5173',
  backendUrl: 'http://localhost:8010'
})

const systemStatus = [
  { icon: '🗄️', label: 'PostgreSQL 数据库', status: 'running' },
  { icon: '⚡', label: 'FastAPI 后端服务', status: 'running' },
  { icon: '🌐', label: 'React 前端服务', status: 'running' },
  { icon: '🔴', label: 'Redis 缓存服务', status: 'running' },
  { icon: '🐳', label: 'Docker 容器', status: 'running' }
]

const quickLinks = [
  { icon: '📖', label: 'API 文档 (Swagger)', url: 'http://localhost:8010/docs' },
  { icon: '📚', label: 'API 参考 (ReDoc)', url: 'http://localhost:8010/redoc' },
  { icon: '⚙️', label: '配置中心', url: 'http://localhost:8010/config' },
  { icon: '❤️', label: '健康检查', url: 'http://localhost:8010/health' },
  { icon: '🌐', label: '学习平台前端', url: 'http://localhost:5173' }
]

function handleSave() {
  ElMessageBox.confirm('确定将最新配置应用到系统吗？', '保存确认', {
    confirmButtonText: '确认应用',
    cancelButtonText: '暂不保存',
    type: 'success'
  }).then(() => {
    ElMessage.success('系统设置已成功保存并生效')
  }).catch(() => {})
}

function handleReset() {
  ElMessageBox.confirm('此操作将当前配置重置为系统默认值。确定要继续吗？', '重置确认', {
    confirmButtonText: '强制重置',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    systemForm.value.platformName = '智辙 A-Track'
    systemForm.value.adminEmail = 'admin@atrack.edu.cn'
    ElMessage.info('已成功重置为系统默认配置')
  }).catch(() => {})
}

function handleExportUsers() {
  ElMessageBox.confirm('确定要全量导出用户数据为 Excel 记录吗？', '确认导出请求', {
    confirmButtonText: '立即导出',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    ElMessage.success('导出任务已排队，文件生成后将自动下载')
  }).catch(() => {})
}

function handleExportLearningData() {
  ElMessageBox.confirm('确定要全量导出学习进度和统计核心数据吗？', '确认导出请求', {
    confirmButtonText: '立即导出',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    ElMessage.success('学习数据报表生成中，请耐心等待...')
  }).catch(() => {})
}

function handleClearCache() {
  ElMessageBox.confirm('高危操作！此操作将清空系统 Redis 存活高速缓存并刷新临时调度任务。\n\n确定执行全干预清理吗？', '缓存清理拦截', {
    confirmButtonText: '彻底清理',
    cancelButtonText: '取消',
    type: 'error'
  }).then(() => {
    ElMessage.success('系统缓存池已触发全量回收与彻底清理！')
  }).catch(() => {})
}

</script>
