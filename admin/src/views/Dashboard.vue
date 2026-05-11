<template>
  <div class="dashboard-container" :class="{ 'is-fullscreen': isFullscreen }" ref="dashboardRef">
    <!-- Header: Title, Clock, Fullscreen -->
    <div class="dashboard-header animate-in">
      <div class="header-left">
        <div class="live-badge">
          <span class="dot"></span> LIVE
        </div>
      </div>
      <div class="header-right">
        <div class="clock">{{ currentTime }}</div>

        <el-button class="fullscreen-btn" @click="toggleFullScreen">
          <el-icon><FullScreen /></el-icon> 全屏监控
        </el-button>
      </div>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" style="margin-bottom: 24px;">
      <el-col :xs="24" :sm="12" :md="6" :lg="6" :xl="6" v-for="(card, idx) in mainStatCards" :key="card.title">
        <div class="stat-card animate-in" :class="[card.type, `animate-in-delay-${idx+1}`]">
          <div class="stat-header">
            <span class="stat-title">{{ card.title }}</span>
            <div class="stat-icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
          </div>
          <div class="stat-value">
            <CountTo :endVal="card.value" :suffix="card.suffix" :decimals="card.decimals || 0" />
          </div>
          <div class="stat-change" :class="card.trend">
            <el-icon :size="14">
              <Top v-if="card.trend === 'up'" />
              <Bottom v-else />
            </el-icon>
            {{ card.changeText }}
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表第一行: 折线图 + 学科环图 -->
    <el-row :gutter="20" style="margin-bottom: 24px;">
      <el-col :xs="24" :lg="16">
        <div class="chart-card animate-in animate-in-delay-3" style="height: 100%; display: flex; flex-direction: column;">
          <div class="chart-title" style="margin-bottom: 10px;">
            实时学习趋势与活跃度
            <span class="chart-subtitle">近30日趋势分析</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <div ref="trendChartRef" style="width: 100%; flex: 1.8; min-height: 220px;"></div>
            <div ref="subTrendChartRef" style="width: 100%; flex: 1; min-height: 140px;"></div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="8">
        <div class="chart-card animate-in animate-in-delay-4" style="height: 100%;">
          <div class="chart-title">学科选修分布</div>
          <div ref="subjectPieRef" style="height: 380px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表第二行: 漏斗图 + 水平分布 + 薄弱排行 -->
    <el-row :gutter="20" style="margin-bottom: 24px;">
      <el-col :xs="24" :md="8" :lg="8">
        <div class="chart-card animate-in animate-in-delay-4">
          <div class="chart-title">学习转化漏斗</div>
          <div class="funnel-wrapper">
            <div class="funnel-labels-container">
              <div v-for="(item, index) in funnelDynamicData" :key="item.name" class="funnel-label-row">
                <div class="funnel-label-name">
                  <span class="color-dot" :style="{ backgroundColor: funnelColors[index] }"></span>
                  {{ item.name }}
                </div>
                <div class="funnel-label-numbers">
                  <span class="funnel-label-val">
                    <CountTo :endVal="item.realValue" :decimals="0" />
                  </span>
                  <span class="funnel-label-pct" v-if="funnelDynamicData[0] && funnelDynamicData[0].realValue > 0">
                    {{ ((item.realValue / funnelDynamicData[0].realValue) * 100).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
            <div ref="funnelChartRef" class="float-animation funnel-chart-shape"></div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :md="8" :lg="8">
        <div class="chart-card animate-in animate-in-delay-5">
          <div class="chart-title">用户水平分布</div>
          <div ref="levelPieRef" style="height: 300px;"></div>
        </div>
      </el-col>
      <el-col :xs="24" :md="8" :lg="8">
        <div class="chart-card animate-in animate-in-delay-6">
          <div class="chart-title">高频薄弱考点 TOP 10</div>
          <div ref="weakBarRef" style="height: 300px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- 最近注册用户流水 -->
    <div class="chart-card list-card animate-in animate-in-delay-6">
      <div class="chart-title">
        实时用户动态
      </div>
      <!-- 自定义表头 -->
      <div style="display: flex; padding: 12px 16px; background: rgba(0,0,0,0.02); color: var(--text-secondary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border);">
        <div style="flex: 1; min-width: 100px;">姓名</div>
        <div style="flex: 2; min-width: 200px;">邮箱</div>
        <div style="flex: 2; min-width: 160px;">选修学科</div>
        <div style="flex: 1; min-width: 80px;">水平</div>
        <div style="flex: 1; min-width: 100px;">状态</div>
        <div style="flex: 1.5; min-width: 160px;">活动时间</div>
      </div>
      <!-- 无缝滚动内容区 -->
      <vue3-seamless-scroll v-if="recentUsers && recentUsers.length > 0" :list="recentUsers" class="seamless-table" :step="0.5" :hover="true" style="height: 340px; overflow: hidden; -webkit-mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%); mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);">
        <div class="scroll-wrapper">
          <div v-for="row in recentUsers" :key="row.id" class="seamless-row" style="display: flex; padding: 14px 16px; border-bottom: 1px solid var(--border); align-items: center; transition: background 0.3s;">
            <div style="flex: 1; min-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              <span class="user-name-link" @click="$router.push(`/users/${row.id}`)">{{ row.name }}</span>
            </div>
          <div style="flex: 2; min-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary);">
            {{ row.email }}
          </div>
          <div style="flex: 2; min-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <el-tag v-for="s in row.enrolledSubjects" :key="s" size="small" color="rgba(0,184,255,0.1)" style="margin: 2px; border: 1px solid rgba(0,184,255,0.3); color: #00b8ff; font-weight: 500;">
              {{ s }}
            </el-tag>
          </div>
          <div style="flex: 1; min-width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary);">
            {{ row.levelLabel }}
          </div>
          <div style="flex: 1; min-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <div class="status-indicator" style="white-space: nowrap;">
              <span class="status-tag" :class="row.status">{{ row.statusLabel || '离线' }}</span>
            </div>
          </div>
          <div style="flex: 1.5; min-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary);">
            {{ row.createdAt }}
          </div>
          </div>
        </div>
      </vue3-seamless-scroll>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { Vue3SeamlessScroll } from 'vue3-seamless-scroll'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import CountTo from '../components/CountTo.vue'
import {
  userList, dailyStats,
  getSubjectDistribution, getLevelDistribution, getWeakPointStats, getStatusDistribution,
  subjects, randomName
} from '../mock/mockData.js'

import { gradientColor, commonTooltip, axisLineStyle, axisLabelStyle, splitLineStyle } from '../utils/echarts.js'

// 头部全屏与时钟
const dashboardRef = ref(null)
const currentTime = ref('')
let clockTimer = null

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}

const isFullscreen = ref(false)
let wasDarkBeforeFullscreen = false

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  
  // 切换全屏时，强行恢复自动轮播，并隐藏所有 tooltip 和高亮，防止出现悬浮孤儿 tooltip
  isHoverPaused = false
  Object.values(chartInstances.value).forEach(chart => {
    if (chart) {
      chart.dispatchAction({ type: 'hideTip' })
      chart.dispatchAction({ type: 'downplay' })
    }
  })

  if (isFullscreen.value) {
    document.body.classList.add('hide-layout')
    wasDarkBeforeFullscreen = document.documentElement.classList.contains('dark')
    if (!wasDarkBeforeFullscreen) {
      document.documentElement.classList.add('dark')
    }
  } else {
    document.body.classList.remove('hide-layout')
    if (!wasDarkBeforeFullscreen) {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // 等待侧边栏等 UI 布局的 transition 动画(常规 300ms) 结束再重新计算尺寸
  setTimeout(() => {
    handleResize()
  }, 350)
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      ElMessage.error(`全屏请求被拒绝: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
}

// 漏斗图动态数据与颜色常数
const funnelDynamicData = ref([])
const funnelColors = ['#90cdf4', '#c3dafe', '#fbd38d', '#f6ad55', '#fc8181']

// 统计卡片 (选取核心4个)
const totalUsers = ref(userList.length)
const activeUsers = ref(userList.filter(u => u.status === 'active').length)
const totalAIInteractions = ref(userList.reduce((a, u) => a + u.aiInteractionCount, 0))
const totalDuration = ref(Math.floor(userList.reduce((a, u) => a + u.totalStudyDuration, 0)/60))

const mainStatCards = ref([
  { title: '平台总用户', value: totalUsers.value, icon: 'User', type: 'primary', trend: 'up', changeText: '环比 +12.5%', suffix: '人' },
  { title: '当前在线活跃', value: activeUsers.value, icon: 'Connection', type: 'success', trend: 'up', changeText: '较昨日同时段 +8%', suffix: '人' },
  { title: '总计学习时长', value: totalDuration.value, icon: 'Timer', type: 'warning', trend: 'up', changeText: '环比 +15%', suffix: '小时' },
  { title: 'AI 交互总频次', value: totalAIInteractions.value, icon: 'ChatDotSquare', type: 'purple', trend: 'up', changeText: '调用激增 +30%', suffix: '次' }
])

watch(() => userList.length, (newLen, oldLen) => {
  if (newLen > 0) {
    if (!oldLen || oldLen === 0) {
      // 防止初次加载数据反应慢导致的 0 异常
      mainStatCards.value[0].value = newLen;
      mainStatCards.value[1].value = userList.filter(u => u.status === 'active').length;
      mainStatCards.value[2].value = Math.floor(userList.reduce((a, u) => a + u.totalStudyDuration, 0)/60);
      mainStatCards.value[3].value = userList.reduce((a, u) => a + u.aiInteractionCount, 0);
    } else {
      const diff = newLen - oldLen;
      const latestUser = userList[0];
      for (let i = 0; i < diff; i++) {
        recentUsers.value.unshift(userList[i]);
      }
      if (recentUsers.value.length > 50) recentUsers.value.length = 50;
      mainStatCards.value[0].value = newLen;
      updateChartsSimulated(diff, latestUser.levelLabel);
    }
  }
}, { immediate: true });

const recentUsers = ref([...userList].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50))

// 图表变量
const trendChartRef = ref(null)
const subTrendChartRef = ref(null)
const subjectPieRef = ref(null)
const funnelChartRef = ref(null)
const levelPieRef = ref(null)
const weakBarRef = ref(null)

const chartInstances = shallowRef({})
let timer = null
let currentTooltipIndex = 0
let currentSubjectIndex = 0
let currentFunnelIndex = 0
let currentLevelIndex = 0
let isHoverPaused = false
let dynamicDailyStats = [...dailyStats]

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  
  initCharts()
  window.addEventListener('resize', handleResize)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  timer = setInterval(simulateRealTimeData, 2000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (timer) clearInterval(timer)
  if (clockTimer) clearInterval(clockTimer)
  Object.values(chartInstances.value).forEach(chart => chart && chart.dispose())
})

function tickAutoTooltip() {
  // 1. 趋势与活跃度联动轮播
  const trendNode = chartInstances.value.trend
  const subTrendNode = chartInstances.value.subTrend
  if (trendNode && subTrendNode) {
    const dataLen = dynamicDailyStats.length
    currentTooltipIndex = (currentTooltipIndex + 1) % dataLen

    trendNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentTooltipIndex })
    subTrendNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentTooltipIndex })
  }

  // 2. 学科选修分布轮播
  const subjectNode = chartInstances.value.subject
  if (subjectNode) {
    const opts = subjectNode.getOption()
    const dataLen = (opts.series && opts.series[0] && opts.series[0].data) ? opts.series[0].data.length : 0
    if (dataLen > 0) {
      currentSubjectIndex = (currentSubjectIndex + 1) % dataLen
      subjectNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentSubjectIndex })
      subjectNode.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      subjectNode.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: currentSubjectIndex })
    }
  }

  // 3. 学习转化漏斗轮播
  const funnelNode = chartInstances.value.funnel
  if (funnelNode) {
    const opts = funnelNode.getOption()
    const dataLen = (opts.series && opts.series[0] && opts.series[0].data) ? opts.series[0].data.length : 0
    if (dataLen > 0) {
      currentFunnelIndex = (currentFunnelIndex + 1) % dataLen
      funnelNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentFunnelIndex })
      funnelNode.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      funnelNode.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: currentFunnelIndex })
    }
  }

  // 4. 用户水平分布轮播
  const levelNode = chartInstances.value.level
  if (levelNode) {
    const opts = levelNode.getOption()
    const dataLen = (opts.series && opts.series[0] && opts.series[0].data) ? opts.series[0].data.length : 0
    if (dataLen > 0) {
      currentLevelIndex = (currentLevelIndex + 1) % dataLen
      levelNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentLevelIndex })
      levelNode.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      levelNode.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: currentLevelIndex })
    }
  }
}

function handleResize() {
  Object.values(chartInstances.value).forEach(chart => chart && chart.resize())
}

function simulateRealTimeData() {
  // 即使没有新用户，持续的系统使用也会使其他指标缓慢增长，保持大屏活性
  mainStatCards.value[1].value += Math.floor(Math.random() * 2); 
  mainStatCards.value[2].value += Math.floor(Math.random() * 2); 
  mainStatCards.value[3].value += Math.floor(Math.random() * 5); 

  // 单纯更新图表推演，不涉及新增用户
  updateChartsSimulated(0, null);

  // 严格同步图表绘制时间线执行 Tooltip，解决 setOption 打断 highlight 的闪烁跳跃问题
  if (!isHoverPaused) {
    tickAutoTooltip();
  }
}

// 已经被上面的watch完全替代，删除原有独立的watch

let subjectStartAngle = 90;
let levelStartAngle = 90;
let funnelPhase = 0;

function updateChartsSimulated(newUsersAdded, newLevel) {
  // 1. 实时学习趋势与活跃度 - 历史数据不变，仅“今日”数据进行实时动态波动
  const lastIndex = dynamicDailyStats.length - 1;
  const todayState = dynamicDailyStats[lastIndex];
  
  todayState.activeUsers = Math.max(50, todayState.activeUsers + Math.floor(Math.random() * 3 - 1));
  todayState.newUsers = Math.max(10, todayState.newUsers + (Math.random() > 0.9 ? 1 : 0));
  // 让今天的分钟数“慢慢”上涨，更符合真实节奏
  todayState.studyDuration += Math.floor(Math.random() * 5 + 1); 

  if (newUsersAdded > 0) {
    todayState.activeUsers += newUsersAdded;
    todayState.newUsers += newUsersAdded;
    todayState.studyDuration += 15 * newUsersAdded;
  }

  if (chartInstances.value.trend) {
    chartInstances.value.trend.setOption({
      series: [
        { data: dynamicDailyStats.map(d => d.activeUsers) },
        { data: dynamicDailyStats.map(d => d.studyDuration) }
      ]
    });
  }

  if (chartInstances.value.subTrend) {
    chartInstances.value.subTrend.setOption({
      series: [
        { data: dynamicDailyStats.map(d => d.newUsers) }
      ]
    });
  }

  // 2. 学科选修分布 - 累积计算逻辑，只增不减
  if (chartInstances.value.subject) {
    subjectStartAngle -= 15;
    let animDur = 2000;
    if (subjectStartAngle < 0) {
      subjectStartAngle += 360;
      animDur = 0; // 跨越 360 度边界时直接零延迟切换，完美杜绝 Echarts 自动脑补的大回环重置逆跳
    }
    
    const pieData = chartInstances.value.subject.getOption().series[0].data;
    const newPieData = pieData.map(item => ({ 
      ...item, 
      value: Number(item.value) + Math.floor(Math.random() * 4) 
    }));
    chartInstances.value.subject.setOption({ 
      series: [{ data: newPieData, startAngle: subjectStartAngle }],
      animationDurationUpdate: animDur
    });
  }

  // 3. 学习转化漏斗 - 左侧文字完全独立固定，右侧图形独立进行浮动，且按数字等比膨胀
  if (chartInstances.value.funnel) {
    // 1. 极其缓慢地累加真实数值，驱动 Vue 双向绑定以更新左侧文字
    let newLabelData = funnelDynamicData.value.map((item, i) => {
      let increment = 0;
      if (newUsersAdded > 0) {
          if (i === 0) increment += newUsersAdded * 2;
          if (i === 1) increment += newUsersAdded;
          if (i === 2) increment += Math.floor(newUsersAdded * 0.8) || 0;
      } else {
          // 常规时间滴答的累加变得非常缓慢，避免跳动太快
          if (Math.random() > 0.85) increment += (i === 0 ? 1 : 0);
          if (Math.random() > 0.95 && i > 0) increment += 1;
      }
      
      let newRealValue = Number(item.realValue) + increment;
      return { 
        ...item, 
        realValue: newRealValue,
        value: newRealValue 
      };
    });

    // 强防倒挂：确保漏斗下层数值始终小于等于上层
    for (let i = 1; i < newLabelData.length; i++) {
        if (newLabelData[i].realValue > newLabelData[i-1].realValue) {
            newLabelData[i].realValue = newLabelData[i-1].realValue;
            newLabelData[i].value = newLabelData[i].realValue;
        }
    }

    // 更新响应式数据让左侧文字缓慢跳动更新
    funnelDynamicData.value = newLabelData;

    // 2. 将严格等比的数值直接赋给 Echarts
    // 去除了之前的横向呼吸(sin wave)效果，完全由数值驱动Echarts的原生等比膨胀过渡动画
    chartInstances.value.funnel.setOption({ 
      series: [
        { 
          // 保持顶层宽度100%，其它层根据真实数值比例自然横向扩充
          max: newLabelData[0].realValue,
          data: newLabelData 
        }
      ] 
    });
  }

  // 4. 用户水平分布 - 累积单调增长
  if (chartInstances.value.level) {
    levelStartAngle -= 10;
    let animDur = 2000;
    if (levelStartAngle < 0) {
      levelStartAngle += 360;
      animDur = 0;
    }
    
    const levelData = chartInstances.value.level.getOption().series[0].data || [];
    const newLevelData = levelData.map(item => {
      let val = Number(item.value) + Math.floor(Math.random() * 3);
      if (newLevel === item.name && newUsersAdded > 0) val += newUsersAdded;
      return { ...item, value: val };
    });
    chartInstances.value.level.setOption({
      series: [
        { data: newLevelData, startAngle: levelStartAngle }
      ],
      animationDurationUpdate: animDur
    });
  }

  // 5. 高频薄弱考点 - 数据单调累加报错频次并重排
  if (chartInstances.value.weak) {
    const option = chartInstances.value.weak.getOption();
    const barData = option.series[0].data;
    const yNames = option.yAxis[0].data;
    
    let paired = barData.map((val, i) => {
      let num = typeof val === 'object' && val !== null ? val.value : val;
      return {
        name: yNames[i],
        value: Number(num) + Math.floor(Math.random() * 4) // 次数累加
      };
    });

    paired.sort((a, b) => b.value - a.value).reverse();

    chartInstances.value.weak.setOption({ 
      yAxis: { data: paired.map(p => p.name) },
      series: [{ data: paired.map(p => p.value) }] 
    });
  }
}

// 初始化各个图表
function initCharts() {
  initTrendChart()
  initSubjectPie()
  initFunnelChart()
  initLevelPie()
  initWeakBar()

  // 统一绑定所有图表的交互与自动轮播控制（防冲突，且无缝接管大屏任意图表的 Hover）
  Object.values(chartInstances.value).forEach(chart => {
    if (chart) {
      chart.off('mouseover')
      chart.off('mouseout')
      chart.on('mouseover', () => { isHoverPaused = true })
      chart.on('mouseout', () => { isHoverPaused = false })
    }
  })
}

function initTrendChart() {
  const chart = echarts.init(trendChartRef.value)
  chartInstances.value.trend = chart
  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'axis', 
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      formatter: (params) => {
        const date = params[0].axisValue;
        const active = params[0] ? params[0].data : 0;
        const hour = params[1] ? params[1].data : 0;
        return `
          <div style="padding: 4px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">${date}</div>
            <div style="display: flex; justify-content: space-between; gap: 20px;">
              <span><span style="display:inline-block;margin-right:4px;border-radius:50%;width:8px;height:8px;background-color:#0091FF;"></span>活跃用户：</span>
              <span>${active} 人</span>
            </div>
            <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 20px;">
              <span><span style="display:inline-block;margin-right:4px;border-radius:50%;width:8px;height:8px;background-color:#FF9500;"></span>学习时长：</span>
              <span>${hour.toLocaleString()} 分钟</span>
            </div>
          </div>
        `;
      }
    },
    legend: { data: ['活跃用户', '学习时长(分钟)'], top: 0, textStyle: { color: '#6b7280', fontSize: 12 } },
    grid: { top: 35, left: '5%', right: '5%', bottom: 5, containLabel: true },
    xAxis: {
      type: 'category',
      data: dynamicDailyStats.map(d => d.date.slice(5)),
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle
    },
    yAxis: [
      {
        type: 'value',
        name: '人数',
        min: 0,
        axisLine: { show: true, lineStyle: { color: '#0091FF' } },
        axisLabel: axisLabelStyle,
        splitLine: splitLineStyle,
        nameTextStyle: { color: '#6b7280' }
      },
      {
        type: 'value',
        name: '分钟',
        min: 0,
        axisLine: { show: true, lineStyle: { color: '#FF9500' } },
        axisLabel: axisLabelStyle,
        splitLine: { show: false },
        nameTextStyle: { color: '#6b7280' }
      }
    ],
    series: [
      {
        name: '活跃用户',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: dynamicDailyStats.map(d => d.activeUsers),
        lineStyle: { width: 3, color: '#0091FF' },
        itemStyle: { color: '#0091FF' },
        areaStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,145,255,0.3)' },
            { offset: 1, color: 'rgba(0,145,255,0.05)' }
          ]) 
        },
        markPoint: {
          data: [
            { type: 'max', name: '峰值' },
            { type: 'min', name: '谷值' }
          ],
          symbolSize: 30,
          label: { fontSize: 9 },
          itemStyle: { color: '#0091FF' }
        },
        animation: true,
        animationDuration: 1500,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 2000,
        animationEasingUpdate: 'linear'
      },
      {
        name: '学习时长(分钟)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: dynamicDailyStats.map(d => d.studyDuration),
        lineStyle: { width: 2, color: '#FF9500', type: 'dashed' },
        itemStyle: { color: '#FF9500' },
        areaStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,149,0,0.2)' },
            { offset: 1, color: 'rgba(255,149,0,0.05)' }
          ]) 
        },
        animation: true,
        animationDuration: 1500,
        animationEasing: 'cubicOut',
        animationDelay: 300,
        animationDurationUpdate: 2000,
        animationEasingUpdate: 'linear'
      }
    ]
  });

  const subChart = echarts.init(subTrendChartRef.value)
  chartInstances.value.subTrend = subChart
  
  subChart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,212,245,0.05)' } },
      formatter: (params) => {
        const date = params[0].axisValue;
        const value = params[0] ? params[0].data : 0;
        return `
          <div style="padding: 4px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">${date}</div>
            <div style="display: flex; justify-content: space-between; gap: 20px;">
              <span><span style="display:inline-block;margin-right:4px;border-radius:50%;width:8px;height:8px;background-color:#00D4F5;"></span>新增用户：</span>
              <span>${value} 人</span>
            </div>
          </div>
        `;
      }
    },
    legend: { data: ['新增用户'], top: 0, textStyle: { color: '#6b7280', fontSize: 12 } },
    grid: { top: 30, left: '5%', right: '5%', bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: dynamicDailyStats.map(d => d.date.slice(5)),
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle
    },
    yAxis: {
      type: 'value',
      name: '新增数',
      min: 0,
      axisLine: { show: true, lineStyle: { color: '#00D4F5' } },
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle,
      nameTextStyle: { color: '#6b7280' }
    },
    series: [
      {
        name: '新增用户',
        type: 'bar',
        barWidth: 8,
        data: dynamicDailyStats.map(d => d.newUsers),
        itemStyle: {
          color: '#00D4F5',
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,212,245,0.5)' }
        },
        markPoint: {
          data: [
            { type: 'max', name: '峰值' }
          ],
          symbolSize: 30,
          label: { fontSize: 9 },
          itemStyle: { color: '#00D4F5' }
        },
        animation: true,
        animationDuration: 1500,
        animationEasing: 'cubicOut',
        animationDelay: 600,
        animationDurationUpdate: 2000,
        animationEasingUpdate: 'linear'
      }
    ]
  });
}

function initSubjectPie() {
  const chart = echarts.init(subjectPieRef.value)
  chartInstances.value.subject = chart
  const data = getSubjectDistribution()
  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'item', 
      position: ['75%', '5%'], // 专门为学科分布保留固定位置，且极度靠右上方，完全不遮挡饼图
      formatter: '{b}: {c} ({d}%)' 
    },
    legend: { 
      bottom: 0, 
      textStyle: { color: '#6b7280', fontSize: 11 }, 
      itemWidth: 12, itemHeight: 12, itemGap: 10,
      width: '100%',
      type: 'plain'
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '42%'],
      roseType: 'area', // 玫瑰空心环图
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { 
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
      },
      data: data.map((d, i) => {
        const lightColors = ['#81d8d0', '#f5a9b8', '#ffe5b4', '#e6e6fa', '#c1e1c1', '#f0e68c'];
        return { ...d, itemStyle: { color: lightColors[i % lightColors.length] } }
      })
    }],
    animationDuration: 1500,
    animationDurationUpdate: 2000,
    animationEasingUpdate: 'linear'
  })
}

function initFunnelChart() {
  const chart = echarts.init(funnelChartRef.value)
  chartInstances.value.funnel = chart
  const baseTotal = totalUsers.value || 120;
  const funnelData = [
    { name: '活跃访客', value: Math.floor(baseTotal * 1.5), realValue: Math.floor(baseTotal * 1.5) },
    { name: '注册用户', value: baseTotal, realValue: baseTotal },
    { name: '课程选修', value: Math.floor(baseTotal * 0.8), realValue: Math.floor(baseTotal * 0.8) },
    { name: '完成学习', value: Math.floor(baseTotal * 0.4), realValue: Math.floor(baseTotal * 0.4) },
    { name: '达标通过', value: Math.floor(baseTotal * 0.2), realValue: Math.floor(baseTotal * 0.2) }
  ]
  
  // 供原生左侧 HTML 消费的数据
  funnelDynamicData.value = funnelData.map(item => ({...item}));
  
  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderColor: 'rgba(0,184,255,0.3)',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const { name, data } = params;
        const realVal = data.realValue;
        const topValue = funnelDynamicData.value[0].realValue;
        const displayPercent = ((realVal / topValue) * 100).toFixed(1);
        const lastValue = realVal * 0.95;
        const chainRate = ((realVal - lastValue) / lastValue * 100).toFixed(1);
        const rateColor = chainRate > 0 ? '#67C23A' : '#F56C6C';
        return `
          <div style="padding: 4px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">${name}</div>
            <div>当前总人数：${Number(realVal).toLocaleString()}人</div>
            <div>整体转化率：${displayPercent}%</div>
            <div>环比：<span style="color: ${rateColor}">${chainRate > 0 ? '+' : ''}${chainRate}%</span></div>
          </div>
        `;
      }
    },
    series: [
      {
        name: '转化漏斗',
        type: 'funnel',
        left: '0%', // 独立出UI后，充满属于自己的弹性空间
        width: '100%',
        height: '80%',
        min: 0,
        max: funnelData[0].value,
        minSize: '0%', 
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 5,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          color: (params) => {
            return funnelColors[params.dataIndex % funnelColors.length];
          }
        },
        emphasis: {
          label: { show: false },
          itemStyle: {
            shadowBlur: 15,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            borderWidth: 3
          }
        },
        data: funnelData.map(item => ({...item}))
      }
    ],
    animationDuration: 1500,
    animationDurationUpdate: 2000,
    animationEasingUpdate: 'linear'
  })
}

function initLevelPie() {
  const chart = echarts.init(levelPieRef.value)
  chartInstances.value.level = chart
  const data = getLevelDistribution()
  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'item',
      position: ['75%', '5%'],
      formatter: '{b}: {c} ({d}%)' 
    },
    legend: { 
      bottom: 0, 
      textStyle: { color: '#6b7280', fontSize: 11 }, 
      itemWidth: 12, itemHeight: 12, itemGap: 10,
      width: '100%',
      type: 'plain'
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        roseType: 'area', // 升级为同款玫瑰空心环图
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { 
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
        },
        data: [
          { value: data[0].value, name: data[0].name, itemStyle: { color: '#90cdf4' } },
          { value: data[1].value, name: data[1].name, itemStyle: { color: '#fbd38d' } },
          { value: data[2].value, name: data[2].name, itemStyle: { color: '#fc8181' } }
        ]
      }
    ],
    animationDurationUpdate: 2000,
    animationEasingUpdate: 'linear'
  })
}

function initWeakBar() {
  const chart = echarts.init(weakBarRef.value)
  chartInstances.value.weak = chart
  const data = getWeakPointStats().slice(0, 10).reverse()
  chart.setOption({
    tooltip: { ...commonTooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,184,255,0.05)' } } },
    grid: { top: 15, left: 100, right: 30, bottom: 20 },
    xAxis: { type: 'value', axisLabel: axisLabelStyle, splitLine: splitLineStyle },
    yAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: axisLabelStyle,
      axisLine: { show: false }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      barWidth: 12,
      itemStyle: {
        color: (params) => {
          const isTop3 = params.dataIndex >= data.length - 3;
          return isTop3 ? gradientColor.pink : gradientColor.lightBlue;
        },
        borderRadius: [0, 6, 6, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,184,255,0.4)' } },
      label: { show: true, position: 'right', color: '#6b7280', fontSize: 11 }
    }],
    animationDuration: 2000,
    animationDurationUpdate: 2000,
    animationEasingUpdate: 'linear'
  })
}

// 监听全屏状态改变（目前不需要改变图表，因为默认就是深色风格，文字用白色）
watch(isFullscreen, () => {
  // 如果之前图表有随外部改变，需要的话可以加 resizer
})
</script>

<style scoped>
.dashboard-container {
  padding-bottom: 20px;
  background-color: transparent; /* 父级负责深色背景 */
  min-height: 100vh;
}

/* 全屏时的深色背景与浅色文字风格 */
.dashboard-container.is-fullscreen {
  background-color: transparent; /* 为了透出底层的 GlobalBackground 动效 */
  padding: 20px;
  overflow-y: auto;
  height: 100vh;
}

.dashboard-container.is-fullscreen .page-title {
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 184, 255, 0.4);
}

.dashboard-container.is-fullscreen .fullscreen-btn {
  color: #fff;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  text-shadow: none;
  transition: all 0.3s;
}

.title-icon {
  color: #00b8ff;
  font-size: 28px;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 20px;
  color: #4ade80;
  font-size: 12px;
  font-weight: bold;
}

.live-badge .dot {
  width: 8px; height: 8px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 8px #22c55e;
  animation: blink 1.5s infinite alternate;
}

@keyframes blink {
  0% { opacity: 0.3; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1.1); }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.clock {
  font-family: 'Outfit', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #00b8ff;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 184, 255, 0.5);
  background: rgba(0,184,255,0.05);
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid rgba(0,184,255,0.2);
}

.fullscreen-btn {
  background: rgba(0, 184, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(0, 184, 255, 0.3);
  font-weight: bold;
  letter-spacing: 1px;
  color: #00b8ff !important;
  transition: all 0.3s;
}

.fullscreen-btn:hover {
  background: rgba(0, 184, 255, 0.2);
  color: #00d4f5 !important;
  box-shadow: 0 0 10px rgba(0, 184, 255, 0.3);
}

.chart-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: 10px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicator-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
}

.indicator-dot.active { background: #4ade80; box-shadow: 0 0 5px #4ade80; }
.indicator-dot.inactive { background: #f59e0b; box-shadow: 0 0 5px #f59e0b; }

.status-tag {
  background: transparent !important;
}

.seamless-row:hover {
  background: rgba(0, 184, 255, 0.05);
}

@keyframes floatUpAndDown {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-18px); }
  100% { transform: translateY(0px); }
}

.float-animation {
  animation: floatUpAndDown 3.5s ease-in-out infinite;
}

@keyframes floatUpAndDown {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-18px); }
  100% { transform: translateY(0px); }
}

.funnel-wrapper {
  display: flex;
  height: 300px;
  align-items: flex-start;
  position: relative;
}

.funnel-labels-container {
  width: 40%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 30px;
  gap: 20px;
  padding-left: 10px;
  z-index: 2;
}

.funnel-label-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.funnel-label-name {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.funnel-label-numbers {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-left: 14px;
}

.funnel-label-val {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
  font-family: 'Outfit', sans-serif;
}

.funnel-label-pct {
  font-size: 12px;
  color: #00b8ff;
  font-weight: 600;
}

.funnel-chart-shape {
  flex: 1;
  height: 100%;
}
</style>

<style>
/* 全屏状态下隐藏 Layout 外壳 */
body.hide-layout .admin-sidebar,
body.hide-layout .admin-header {
  display: none !important;
}
body.hide-layout .admin-main {
  margin-left: 0 !important;
}
body.hide-layout .page-content {
  padding: 0 !important;
}
</style>
