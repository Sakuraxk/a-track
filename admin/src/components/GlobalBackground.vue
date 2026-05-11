<template>
  <div class="global-bg-container">
    <!-- Canvas Particle Background -->
    <canvas ref="particleCanvasRef" class="particle-canvas"></canvas>

    <!-- Animated Background Orbs -->
    <div class="bg-shape shape-blue"></div>
    <div class="bg-shape shape-purple"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// === Particle Canvas State ===
const particleCanvasRef = ref(null)
let animationFrameId = null

onMounted(() => {
  const canvas = particleCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let w = canvas.width = window.innerWidth
  let h = canvas.height = window.innerHeight
  const particles = []
  const mouse = { x: null, y: null }

  class Particle {
    constructor() {
      this.x = Math.random() * w
      this.y = Math.random() * h
      this.size = Math.random() * 4 + 2
      this.speedX = Math.random() * 1 - 0.5
      this.speedY = Math.random() * 1 - 0.5
      // Cool tech color palette
      const colors = ['rgba(59, 130, 246, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(45, 212, 191, 0.8)']
      this.color = colors[Math.floor(Math.random() * colors.length)]
    }
    update() {
      this.x += this.speedX
      this.y += this.speedY
      if(this.x < 0 || this.x > w) this.speedX *= -1
      if(this.y < 0 || this.y > h) this.speedY *= -1
    }
    draw() {
      ctx.fillStyle = this.color
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function init() {
    particles.length = 0
    for(let i = 0; i < 30; i++) particles.push(new Particle())
  }

  function animate() {
    ctx.clearRect(0, 0, w, h)
    particles.forEach(p => { p.update(); p.draw() })
    animationFrameId = requestAnimationFrame(animate)
  }

  const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; init() }

  window.addEventListener('resize', handleResize)

  init()
  animate()

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<style scoped>
.global-bg-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  background-color: var(--bg-base);
  pointer-events: none;
  overflow: hidden;
}

/* Particle Canvas */
.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Background Animations (Liquid Glass Base) */
.bg-shape {
  position: absolute;
  filter: blur(120px);
  z-index: 0;
  border-radius: 50%;
  animation: float 20s infinite ease-in-out;
  opacity: 0.6;
}

.shape-blue {
  background: radial-gradient(circle at center, oklch(65% 0.15 240 / 60%), oklch(65% 0.15 240 / 0%));
  width: 600px;
  height: 600px;
  top: -10%;
  left: -10%;
  animation-delay: 0s;
}

.shape-purple {
  background: radial-gradient(circle at center, oklch(60% 0.18 300 / 50%), oklch(60% 0.18 300 / 0%));
  width: 500px;
  height: 500px;
  bottom: 0%;
  right: -5%;
  animation-delay: -5s;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
}
</style>
