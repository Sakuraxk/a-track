import * as echarts from 'echarts'

// 全局响应式渐变色配置
export const gradientColor = {
  blue: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#00b8ff' },
    { offset: 1, color: '#0078ff' }
  ]),
  purple: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#722ed1' },
    { offset: 1, color: '#b37eff' }
  ]),
  green: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#00e5ff' },
    { offset: 1, color: '#00a3ff' }
  ]),
  orange: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#ffb347' },
    { offset: 1, color: '#ff7b00' }
  ]),
  red: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#ff4d4f' },
    { offset: 1, color: '#ff003c' }
  ]),
  lightBlue: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#90cdf4' },
    { offset: 1, color: '#4299e1' }
  ]),
  pink: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#fbb6ce' },
    { offset: 1, color: '#ed64a6' }
  ])
}

// 通用的 tooltip 毛玻璃大屏风格
export const commonTooltip = {
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderColor: 'rgba(0, 0, 0, 0.1)',
  borderWidth: 1,
  padding: [10, 15],
  textStyle: {
    color: '#333333',
    fontSize: 13
  },
  extraCssText: 'backdrop-filter: blur(10px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 8px;'
}

// 坐标轴等通用配置
export const axisLineStyle = {
  lineStyle: {
    color: '#e5e7eb'
  }
}

export const axisLabelStyle = {
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 500
}

export const splitLineStyle = {
  lineStyle: {
    color: '#f3f4f6',
    type: 'dashed'
  }
}
