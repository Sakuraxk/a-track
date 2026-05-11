<template>
  <span>{{ displayValue }}</span>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  startVal: { type: Number, default: 0 },
  endVal: { type: Number, required: true },
  duration: { type: Number, default: 1500 },
  decimals: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  useEasing: { type: Boolean, default: true }
})

const displayValue = ref('')

let startTime = null
let localStartVal = props.startVal
let animationFrame = null

function formatValue(val) {
  let res = Number(val).toFixed(props.decimals)
  if (res === 'NaN') res = '0'
  const parts = res.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  displayValue.value = props.prefix + parts.join('.') + props.suffix
}

// 初始化先显示
formatValue(localStartVal)

function executeAnimation(timestamp) {
  if (!startTime) startTime = timestamp
  const progress = timestamp - startTime
  let currentVal

  if (props.useEasing) {
    const t = Math.min(progress / props.duration, 1)
    currentVal = t === 1 ? props.endVal : localStartVal + (props.endVal - localStartVal) * (-Math.pow(2, -10 * t) + 1)
  } else {
    currentVal = localStartVal + ((props.endVal - localStartVal) * Math.min(progress / props.duration, 1))
  }

  const isComplete = progress >= props.duration
  if (isComplete) {
    currentVal = props.endVal
  }

  formatValue(currentVal)

  if (!isComplete) {
    animationFrame = requestAnimationFrame(executeAnimation)
  }
}

// formatValue hoisted

onMounted(() => {
  animationFrame = requestAnimationFrame(executeAnimation)
})

watch(() => props.endVal, (newVal, oldVal) => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  localStartVal = oldVal || 0
  startTime = null
  animationFrame = requestAnimationFrame(executeAnimation)
})

</script>
