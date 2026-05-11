<template>
  <div>
    <!-- 分数分布 & 学习时长分布 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-1">
          <div class="chart-title">分数段分布</div>
          <div ref="scoreDistRef" style="height: 340px;"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-2">
          <div class="chart-title">学习时长分布</div>
          <div ref="durationDistRef" style="height: 340px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- 各学科正确率对比 & 完成率对比 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-3">
          <div class="chart-title">各学科平均正确率</div>
          <div ref="subjectAccuracyRef" style="height: 340px;"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12" style="margin-bottom: 24px;">
        <div class="chart-card animate-in animate-in-delay-4">
          <div class="chart-title">各学科学习完成率</div>
          <div ref="subjectCompletionRef" style="height: 340px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- AI 使用热力图 -->
    <div class="chart-card animate-in animate-in-delay-5" style="margin-bottom: 24px;">
      <div class="chart-title">AI 导师使用趋势（近30天）</div>
      <div ref="aiTrendRef" style="height: 300px;"></div>
    </div>

    <!-- 知识薄弱点全局分析 -->
    <div class="chart-card animate-in animate-in-delay-6">
      <div class="chart-title">全平台薄弱知识点 TOP 15</div>
      <div ref="globalWeakRef" style="height: 400px;"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { subjects, userList, dailyStats, getScoreDistribution, getWeakPointStats } from '../mock/mockData.js'
import { gradientColor, commonTooltip, axisLineStyle, axisLabelStyle, splitLineStyle } from '../utils/echarts.js'

const scoreDistRef = ref(null)
const durationDistRef = ref(null)
const subjectAccuracyRef = ref(null)
const subjectCompletionRef = ref(null)
const aiTrendRef = ref(null)
const globalWeakRef = ref(null)

const chartInstances = shallowRef({})
let timer = null
let isHoverPaused = false

let currentScoreIndex = 0
let currentDurationIndex = 0
let currentAccuracyIndex = 0
let currentCompletionIndex = 0
let currentTrendIndex = 0
let currentWeakIndex = 0

onMounted(() => {
  refreshCharts()
  window.addEventListener('resize', handleResize)
  timer = setInterval(tickAutoTooltip, 2500)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (timer) clearInterval(timer)
  Object.values(chartInstances.value).forEach(chart => chart && chart.dispose())
})

function handleResize() {
  Object.values(chartInstances.value).forEach(chart => chart && chart.resize())
}

function refreshCharts() {
  initScoreDist()
  initDurationDist()
  initSubjectAccuracy()
  initSubjectCompletion()
  initAITrend()
  initGlobalWeak()

  Object.values(chartInstances.value).forEach(chart => {
    if (chart) {
      chart.off('mouseover')
      chart.off('mouseout')
      chart.on('mouseover', () => { isHoverPaused = true })
      chart.on('mouseout', () => { isHoverPaused = false })
    }
  })
}

function tickAutoTooltip() {
  if (isHoverPaused) return

  const scoreNode = chartInstances.value.score
  if (scoreNode) {
    const opts = scoreNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentScoreIndex = (currentScoreIndex + 1) % dataLen
      scoreNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentScoreIndex })
    }
  }

  const durationNode = chartInstances.value.duration
  if (durationNode) {
    const opts = durationNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentDurationIndex = (currentDurationIndex + 1) % dataLen
      durationNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentDurationIndex })
    }
  }

  const accuracyNode = chartInstances.value.accuracy
  if (accuracyNode) {
    const opts = accuracyNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentAccuracyIndex = (currentAccuracyIndex + 1) % dataLen
      accuracyNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentAccuracyIndex })
    }
  }

  const completionNode = chartInstances.value.completion
  if (completionNode) {
    const opts = completionNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentCompletionIndex = (currentCompletionIndex + 1) % dataLen
      completionNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentCompletionIndex })
      completionNode.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      completionNode.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: currentCompletionIndex })
    }
  }

  const trendNode = chartInstances.value.trend
  if (trendNode) {
    const opts = trendNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentTrendIndex = (currentTrendIndex + 1) % dataLen
      trendNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentTrendIndex })
    }
  }

  const weakNode = chartInstances.value.weak
  if (weakNode) {
    const opts = weakNode.getOption()
    const dataLen = opts.series[0].data.length
    if (dataLen > 0) {
      currentWeakIndex = (currentWeakIndex + 1) % dataLen
      weakNode.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentWeakIndex })
    }
  }
}

function initScoreDist() {
  if (!chartInstances.value.score) chartInstances.value.score = echarts.init(scoreDistRef.value)
  const chart = chartInstances.value.score
  const data = getScoreDistribution()
  chart.setOption({
    tooltip: { 
      ...commonTooltip,
      trigger: 'axis', 
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,184,255,0.05)' } }
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', show: true, bottom: 0, height: 12, borderColor: 'transparent', fillerColor: 'rgba(0,184,255,0.1)' }
    ],
    grid: { top: 30, left: 50, right: 20, bottom: 40 },
    xAxis: { 
      type: 'category', 
      data: data.map(d => d.name), 
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle
    },
    yAxis: { 
      type: 'value',
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle,
      axisLine: { show: false }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      barWidth: 24,
      itemStyle: {
        color: (params) => {
          // 统一渐变：最高分段(最后一项)特别展示粉色高光，其余统一采用高级浅蓝渐变
          return params.dataIndex === data.length - 1 ? gradientColor.pink : gradientColor.lightBlue;
        },
        borderRadius: [6, 6, 0, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,184,255,0.4)' } },
      label: { show: true, position: 'top', color: '#6b7280', fontSize: 11 }
    }],
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut'
  })
}

function initDurationDist() {
  if (!chartInstances.value.duration) chartInstances.value.duration = echarts.init(durationDistRef.value)
  const chart = chartInstances.value.duration
  const ranges = { '0-2h': 0, '2-5h': 0, '5-10h': 0, '10-20h': 0, '20h+': 0 }
  userList.forEach(u => {
    const h = u.totalStudyDuration / 60
    if (h < 2) ranges['0-2h']++
    else if (h < 5) ranges['2-5h']++
    else if (h < 10) ranges['5-10h']++
    else if (h < 20) ranges['10-20h']++
    else ranges['20h+']++
  })
  const data = Object.entries(ranges)
  chart.setOption({
    tooltip: { 
      ...commonTooltip,
      trigger: 'axis', 
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,212,245,0.05)' } }
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', show: true, bottom: 0, height: 12, borderColor: 'transparent', fillerColor: 'rgba(0,212,245,0.1)' }
    ],
    grid: { top: 30, left: 50, right: 20, bottom: 40 },
    xAxis: { 
      type: 'category', 
      data: data.map(d => d[0]),
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle
    },
    yAxis: { 
      type: 'value',
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle,
      axisLine: { show: false }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d[1]),
      barWidth: 24,
      itemStyle: {
        color: (params) => {
          // 最长学习时长(高粘性)特别展示为强调渐变，其余统一蓝底
          return params.dataIndex >= data.length - 2 ? gradientColor.blue : gradientColor.lightBlue;
        },
        borderRadius: [6, 6, 0, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,184,255,0.4)' } },
      label: { show: true, position: 'top', color: '#6b7280', fontSize: 11 }
    }],
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut'
  })
}

function initSubjectAccuracy() {
  if (!chartInstances.value.accuracy) chartInstances.value.accuracy = echarts.init(subjectAccuracyRef.value)
  const chart = chartInstances.value.accuracy
  const data = subjects.map(sub => {
    const profiles = []
    userList.forEach(u => {
      u.subjectProfiles.forEach(sp => {
        if (sp.subjectKey === sub.key) profiles.push(sp)
      })
    })
    const avg = profiles.length > 0
      ? (profiles.reduce((a, p) => a + p.score, 0) / profiles.length).toFixed(1)
      : 0
    return { name: sub.name, value: parseFloat(avg) }
  })

  chart.setOption({
    tooltip: { 
      ...commonTooltip,
      trigger: 'axis', 
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,184,255,0.05)' } } 
    },
    dataZoom: [{ type: 'inside', yAxisIndex: 0 }],
    grid: { top: 20, left: 80, right: 30, bottom: 20 },
    xAxis: { 
      type: 'value', 
      max: 100,
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle
    },
    yAxis: { 
      type: 'category', 
      data: data.map(d => d.name),
      axisLabel: axisLabelStyle,
      axisLine: { show: false }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      barWidth: 16,
      itemStyle: {
        color: (params) => {
           // 正确率横向柱状图同样遵循数据大屏的淡蓝色渐变体系
          return gradientColor.lightBlue;
        },
        borderRadius: [0, 6, 6, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,229,255,0.4)' } },
      label: { show: true, position: 'right', color: '#6b7280', fontSize: 11 }
    }],
    animation: true,
    animationDuration: 1200
  })
}

function initSubjectCompletion() {
  if (!chartInstances.value.completion) chartInstances.value.completion = echarts.init(subjectCompletionRef.value)
  const chart = chartInstances.value.completion
  const data = subjects.map(sub => {
    const profiles = []
    userList.forEach(u => {
      u.subjectProfiles.forEach(sp => {
        if (sp.subjectKey === sub.key) profiles.push(sp)
      })
    })
    const avg = profiles.length > 0
      ? (profiles.reduce((a, p) => a + p.completionRate, 0) / profiles.length).toFixed(1)
      : 0
    return { name: sub.name, value: parseFloat(avg) }
  })

  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'item', 
      position: ['75%', '5%'],
      formatter: '{b}: {c}%' 
    },
    legend: { 
      bottom: 0, 
      textStyle: { color: '#6b7280', fontSize: 11 }, 
      itemWidth: 12, itemHeight: 12, itemGap: 10,
      type: 'plain'
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '42%'],
      roseType: 'area',
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { 
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#333' },
        itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
      },
      data: data.map((d, i) => {
        const lightColors = ['#81d8d0', '#f5a9b8', '#ffe5b4', '#e6e6fa', '#c1e1c1', '#f0e68c'];
        return { ...d, itemStyle: { color: lightColors[i % lightColors.length] } }
      })
    }],
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut'
  })
}

function initAITrend() {
  if (!chartInstances.value.trend) chartInstances.value.trend = echarts.init(aiTrendRef.value)
  const chart = chartInstances.value.trend
  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'axis', 
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,184,255,0.2)' } } 
    },
    dataZoom: [{ type: 'inside' }],
    grid: { top: 30, left: 50, right: 30, bottom: 20 },
    xAxis: { 
      type: 'category', 
      data: dailyStats.map(d => d.date.slice(5)),
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle
    },
    yAxis: { 
      type: 'value', 
      name: '次数',
      min: 0,
      axisLine: { show: true, lineStyle: { color: '#00D4F5' } },
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle,
      nameTextStyle: { color: '#6b7280' }
    },
    series: [{
      name: 'AI使用次数',
      type: 'line',
      data: dailyStats.map(d => d.aiInteractions),
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: '#00D4F5' },
      itemStyle: { color: '#00D4F5' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0,212,245,0.3)' },
          { offset: 1, color: 'rgba(0,212,245,0.05)' }
        ])
      },
      markPoint: {
        data: [{ type: 'max', name: 'Max' }, { type: 'min', name: 'Min' }],
        symbolSize: 30,
        itemStyle: { color: '#00D4F5' },
        label: { fontSize: 9 }
      },
      markLine: {
        data: [{ type: 'average', name: '平均值' }],
        lineStyle: { color: '#FAAD14', type: 'dashed' },
        label: { fontSize: 11, color: '#6b7280' }
      }
    }],
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut'
  })
}

function initGlobalWeak() {
  if (!chartInstances.value.weak) chartInstances.value.weak = echarts.init(globalWeakRef.value)
  const chart = chartInstances.value.weak
  const data = getWeakPointStats().slice(0, 15).reverse()
  chart.setOption({
    tooltip: { 
      ...commonTooltip, 
      trigger: 'axis', 
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,184,255,0.05)' } } 
    },
    dataZoom: [
      { type: 'inside', yAxisIndex: 0 },
      { type: 'slider', yAxisIndex: 0, right: 10, width: 12, borderColor: 'transparent', fillerColor: 'rgba(0,184,255,0.1)' }
    ],
    grid: { top: 15, left: 100, right: 30, bottom: 20 },
    xAxis: { 
      type: 'value',
      axisLabel: axisLabelStyle,
      splitLine: splitLineStyle
    },
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
</script>
