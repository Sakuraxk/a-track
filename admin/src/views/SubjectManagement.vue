<template>
  <div>
    <el-row :gutter="20">
      <el-col :xs="24" :md="12" :xl="8" v-for="(subject, idx) in subjects" :key="subject.id">
        <div class="chart-card animate-in" :class="`animate-in-delay-${idx+1}`" style="margin-bottom: 20px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 20px;">
            <div style="display:flex; align-items:center; gap: 12px;">
              <div :style="`display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background-color: ${subject.bgColor || 'var(--bg-base)'};`">
                <Icon :icon="subject.icon" :style="`font-size: 32px; color: ${subject.color || 'var(--primary)'};`" />
              </div>
              <div>
                <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: 0.5px;">{{ subject.name }}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">{{ subject.key }}</div>
              </div>
            </div>
            <el-switch v-model="subject.isActive" :before-change="() => handleToggleStatus(subject)" />
          </div>
          <div style="font-size: 14px; color: var(--text-regular); margin-bottom: 16px; line-height: 1.6;">
            {{ subject.description }}
          </div>

          <!-- 学科统计 -->
          <el-row :gutter="12">
            <el-col :span="8">
              <div style="text-align: center; padding: 12px 0; background: var(--bg-base); border-radius: 8px;">
                <div style="font-size: 22px; font-weight: 700; color: var(--primary);">{{ subjectStats[subject.key].enrolled }}</div>
                <div style="font-size: 12px; font-weight: 500; color: var(--text-regular); margin-top: 2px;">选修人数</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div style="text-align: center; padding: 12px 0; background: var(--bg-base); border-radius: 8px;">
                <div style="font-size: 22px; font-weight: 700; color: var(--success);">{{ subjectStats[subject.key].avgScore }}</div>
                <div style="font-size: 12px; font-weight: 500; color: var(--text-regular); margin-top: 2px;">平均分</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div style="text-align: center; padding: 12px 0; background: var(--bg-base); border-radius: 8px;">
                <div style="font-size: 22px; font-weight: 700; color: var(--warning);">{{ subjectStats[subject.key].avgCompletion }}%</div>
                <div style="font-size: 12px; font-weight: 500; color: var(--text-regular); margin-top: 2px;">完成率</div>
              </div>
            </el-col>
          </el-row>

          <!-- 知识节点统计 -->
          <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">薄弱知识点 TOP 3</div>
            <div v-for="wp in subjectStats[subject.key].topWeakPoints" :key="wp.name"
              style="display:flex; align-items:center; justify-content:space-between; padding: 6px 0; font-size: 13px;">
              <span style="color: var(--text-regular); font-weight: 500;">{{ wp.name }}</span>
              <el-progress :percentage="wp.percentage" :stroke-width="8" style="width: 120px;"
                :color="wp.percentage > 60 ? '#ef4444' : wp.percentage > 30 ? '#f59e0b' : '#22c55e'" />
            </div>
          </div>

          <div style="margin-top: 16px; display:flex; gap:8px;">
            <el-button size="small" plain @click="openSchemeDialog(subject, '题库管理')">题库管理</el-button>
            <el-button size="small" plain @click="openSchemeDialog(subject, '知识图谱')">知识图谱</el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 方案选择弹窗 -->
    <el-dialog v-model="schemeDialogVisible" :title="`配置${currentSubject?.name}${currentFeature}`" width="480px" destroy-on-close>
      <div class="scheme-list" v-if="currentFeature === '题库管理'">
        <div class="scheme-card" v-for="(scheme, i) in bankSchemes" :key="i" @click="confirmScheme(scheme.title)">
          <div class="scheme-header">
            <Icon :icon="scheme.icon" class="scheme-icon" />
            <span class="scheme-title">{{ scheme.title }}</span>
          </div>
          <div class="scheme-desc">{{ scheme.desc }}</div>
        </div>
      </div>
      <div class="scheme-list" v-else-if="currentFeature === '知识图谱'">
        <div class="scheme-card" v-for="(scheme, i) in graphSchemes" :key="i" @click="confirmScheme(scheme.title)">
          <div class="scheme-header">
            <Icon :icon="scheme.icon" class="scheme-icon" />
            <span class="scheme-title">{{ scheme.title }}</span>
          </div>
          <div class="scheme-desc">{{ scheme.desc }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { subjects, userList } from '../mock/mockData.js'

const handleToggleStatus = (subject) => {
  const actionText = subject.isActive ? '停用' : '启用'
  return new Promise((resolve, reject) => {
    ElMessageBox.confirm(`确定要${actionText}【${subject.name}】吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        ElMessage.success(`已成功${actionText}`)
        resolve(true)
      })
      .catch(() => {
        reject(false) // 恢复开关状态
      })
  })
}

// 方案选择逻辑
const schemeDialogVisible = ref(false)
const currentSubject = ref(null)
const currentFeature = ref('')

const bankSchemes = [
  { title: '基础同步题库', desc: '覆盖全大纲基础知识，适合学生日常同步练习打卡', icon: 'lucide:book-open' },
  { title: '强化满分突破', desc: '含历年真题及高频易错题，适合提升进阶与薄弱点突破', icon: 'lucide:flame' },
  { title: '考前冲刺预测', desc: '提供全真模拟、密卷与命题预测，冲刺阶段提分专属', icon: 'lucide:target' }
]

const graphSchemes = [
  { title: '核心考向路线图', desc: '提炼主干知识与核心考点，串联最关键的知识脉络', icon: 'lucide:git-pull-request' },
  { title: '高频易错网络', desc: '专项展示易混淆概念、常错及陷阱关联', icon: 'lucide:alert-triangle' },
  { title: '全景精细知识树', desc: '完整且下钻极深，呈现该学科最详尽的知识切片结构', icon: 'lucide:network' }
]

const openSchemeDialog = (subject, featureName) => {
  currentSubject.value = subject
  currentFeature.value = featureName
  schemeDialogVisible.value = true
}

const confirmScheme = (schemeTitle) => {
  schemeDialogVisible.value = false
  ElMessage.success(`已为【${currentSubject.value.name}】应用方案：${schemeTitle}`)
}

const subjectStats = computed(() => {
  const stats = {}
  subjects.forEach(sub => {
    const profiles = []
    userList.forEach(u => {
      u.subjectProfiles.forEach(sp => {
        if (sp.subjectKey === sub.key) profiles.push(sp)
      })
    })

    const enrolled = profiles.length
    const avgScore = enrolled > 0 ? Math.round(profiles.reduce((a, p) => a + p.score, 0) / enrolled) : 0
    const avgCompletion = enrolled > 0 ? (profiles.reduce((a, p) => a + p.completionRate, 0) / enrolled).toFixed(1) : 0

    // 薄弱知识点统计
    const wpCount = {}
    profiles.forEach(p => {
      p.weakPoints.forEach(wp => {
        wpCount[wp] = (wpCount[wp] || 0) + 1
      })
    })
    const topWeakPoints = Object.entries(wpCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round(count / enrolled * 100)
      }))

    stats[sub.key] = { enrolled, avgScore, avgCompletion, topWeakPoints }
  })
  return stats
})
</script>

<style scoped>
.scheme-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0 16px;
}
.scheme-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: var(--bg-base);
}
.scheme-card:hover {
  border-color: var(--primary);
  background-color: var(--primary-light-9);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--primary-light-8);
}
.scheme-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.scheme-icon {
  font-size: 20px;
  color: var(--primary);
}
.scheme-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.scheme-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding-left: 28px;
}
</style>
