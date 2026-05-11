<template>
  <div v-if="user">
    <!-- 返回按钮 -->
    <el-button link @click="$router.back()" style="margin-bottom: 16px; font-size: 14px;">
      <el-icon><ArrowLeft /></el-icon> 返回用户列表
    </el-button>

    <!-- 用户信息头 -->
    <div class="detail-header animate-in">
      <img :src="user.avatar" class="user-avatar" />
      <div class="user-info" style="flex: 1;">
        <h2>{{ user.name }} <span class="status-tag" :class="user.status" style="font-size:12px; vertical-align: middle;">{{ user.statusLabel }}</span></h2>
        <div class="user-meta">
          <span>📧 {{ user.email }}</span>
          <span>📱 {{ user.phone }}</span>
          <span>🎓 {{ user.levelLabel }}</span>
          <span>📅 注册时间：{{ user.createdAt }}</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">用户等级</div>
        <div style="font-size: 28px; font-weight: 700; color: var(--primary);">Lv.{{ user.userLevel }}</div>
        <div style="font-size: 12px; color: var(--text-muted);">{{ user.xp }} XP</div>
      </div>
    </div>

    <!-- 学习概览卡片 -->
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 16px;">
        <div class="stat-card primary animate-in animate-in-delay-1">
          <div class="stat-title">选修学科</div>
          <div class="stat-value">{{ user.enrolledSubjects.length }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 16px;">
        <div class="stat-card success animate-in animate-in-delay-2">
          <div class="stat-title">总学习时长</div>
          <div class="stat-value">{{ user.totalStudyDurationFormatted }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 16px;">
        <div class="stat-card warning animate-in animate-in-delay-3">
          <div class="stat-title">练习次数</div>
          <div class="stat-value">{{ user.totalPracticeCount }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 24px;">
        <div class="stat-card info animate-in animate-in-delay-4">
          <div class="stat-title">正确率</div>
          <div class="stat-value">{{ user.correctRate }}%</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 24px;">
        <div class="stat-card purple animate-in animate-in-delay-5">
          <div class="stat-title">AI 对话</div>
          <div class="stat-value">{{ user.aiInteractionCount }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8" style="margin-bottom: 24px;">
        <div class="stat-card danger animate-in animate-in-delay-6">
          <div class="stat-title">连续打卡</div>
          <div class="stat-value">{{ user.streakDays }}天</div>
        </div>
      </el-col>
    </el-row>

    <!-- 学科档案 & 能力雷达图 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="14" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-3">
          <div class="chart-title">学科学习档案</div>
          <el-table :data="user.subjectProfiles" style="width: 100%;">
            <el-table-column prop="subjectName" label="学科" width="160">
              <template #default="{ row }">
                <el-tag effect="plain" round>{{ row.subjectName }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="学习进度" width="200">
              <template #default="{ row }">
                <el-progress :percentage="row.completionRate" :stroke-width="10"
                  :color="row.completionRate >= 80 ? '#22c55e' : row.completionRate >= 50 ? '#f59e0b' : '#ef4444'" />
              </template>
            </el-table-column>
            <el-table-column prop="score" label="评估分数" width="100">
              <template #default="{ row }">
                <span style="font-weight: 600;" :style="{ color: row.score >= 85 ? '#22c55e' : row.score >= 70 ? '#f59e0b' : '#ef4444' }">{{ row.score }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="masteredNodes" label="已掌握/总计" width="110">
              <template #default="{ row }">
                {{ row.masteredNodes }} / {{ row.totalNodes }}
              </template>
            </el-table-column>
            <el-table-column prop="onboardingStatus" label="评估状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.onboardingStatus === 'completed' ? 'success' : row.onboardingStatus === 'in_progress' ? 'warning' : 'info'" size="small">
                  {{ row.onboardingStatus === 'completed' ? '已完成' : row.onboardingStatus === 'in_progress' ? '进行中' : '未开始' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="薄弱知识点">
              <template #default="{ row }">
                <el-tag v-for="wp in row.weakPoints" :key="wp" type="danger" size="small" style="margin: 1px;" effect="plain">{{ wp }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :xs="24" :lg="10" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-4">
          <div class="chart-title">能力雷达图</div>
          <div ref="radarRef" style="height: 350px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- AI 对话记录 & 学习建议 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-5">
          <div class="chart-title">🤖 AI 导师对话记录（最近）</div>
          <div style="max-height: 350px; overflow-y: auto;">
            <div v-for="(msg, idx) in conversations" :key="idx"
              style="padding: 12px 16px; margin-bottom: 8px; border-radius: 10px;"
              :style="{
                background: msg.role === 'user' ? 'rgba(99,102,241,0.06)' : 'rgba(34,197,94,0.06)',
                marginLeft: msg.role === 'user' ? '40px' : '0',
                marginRight: msg.role === 'assistant' ? '40px' : '0'
              }">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">
                {{ msg.role === 'user' ? '👤 ' + user.name : '🤖 AI 导师' }}
              </div>
              <div style="font-size: 13px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;">{{ msg.content }}</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-6">
          <div class="chart-title">📋 AI 个性化学习建议</div>
          <div style="padding: 8px 0;">
            <div v-for="(advice, idx) in learningAdvices" :key="idx"
              style="padding: 14px 18px; background: var(--bg-base); border-radius: 10px; margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: var(--text-primary);">
              {{ advice }}
            </div>
          </div>
          <div style="margin-top: 16px; padding: 16px; background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06)); border-radius: 12px;">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary);">📊 学习模式分析</div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.8;">
              ① 该用户偏好{{ user.paceLabel }}学习节奏<br>
              ② 最活跃时段为晚间 20:00-22:00<br>
              ③ 擅长理论学习，实践练习薄弱<br>
              ④ AI 导师互动频率{{ user.aiInteractionCount > 50 ? '较高' : '偏低' }}，建议{{ user.aiInteractionCount > 50 ? '继续保持' : '增加互动' }}
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { userList, generateAIConversation, generateLearningAdvice } from '../mock/mockData.js'

const route = useRoute()
const radarRef = ref(null)

const user = computed(() => {
  return userList.find(u => u.id === route.params.id)
})

const conversations = computed(() => {
  if (!user.value) return []
  const mainSubject = user.value.enrolledSubjects[0] || 'Python'
  return generateAIConversation(user.value.name, mainSubject)
})

const learningAdvices = computed(() => {
  if (!user.value || !user.value.subjectProfiles.length) return []
  return generateLearningAdvice(user.value.subjectProfiles[0])
})

onMounted(() => {
  if (user.value) initRadar()
})

function initRadar() {
  const chart = echarts.init(radarRef.value)
  const profile = user.value.subjectProfiles[0]
  if (!profile) return

  const tags = profile.abilityTags
  const keys = Object.keys(tags).slice(0, 8) // 取前8个能力维度

  chart.setOption({
    tooltip: { 
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0'
    },
    radar: {
      indicator: keys.map(k => ({ name: k, max: 100 })),
      shape: 'polygon',
      splitArea: { areaStyle: { color: ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.05)'] } },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      name: { textStyle: { fontSize: 11, color: '#64748b' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: keys.map(k => tags[k]),
        name: profile.subjectName + ' 能力分布',
        lineStyle: { color: '#4080FF', width: 2 },
        itemStyle: { color: '#4080FF' },
        areaStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
            { color: 'rgba(64,128,255,0.3)', offset: 0 },
            { color: 'rgba(64,128,255,0.05)', offset: 1 }
          ])
        },
        emphasis: {
          lineStyle: { width: 4 },
          areaStyle: { color: 'rgba(64,128,255,0.25)' }
        }
      }]
    }],
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut'
  })
  chart.on('click', params => {
    ElMessage.info(`[能力分布] ${params.name}: ${params.value.join(', ')}`)
  })
  window.addEventListener('resize', () => chart.resize())
}
</script>
