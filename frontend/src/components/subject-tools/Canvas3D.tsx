/**
 * 3D 函数曲面渲染器 — 基于 Three.js + OrbitControls
 * 支持鼠标/触控旋转、缩放、平移，表达式切换渐变动画
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { sampleFunction3D } from '@/lib/mathEngine'

interface Canvas3DProps {
  expression: string
  range?: number
  resolution?: number
  className?: string
}

export default function Canvas3D({
  expression,
  range = 5,
  resolution = 50,
  className = '',
}: Canvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    mesh: THREE.Mesh | null
    animId: number
    needsRender: boolean
  } | null>(null)

  const [hoverCoord, setHoverCoord] = useState('')

  const buildMesh = useCallback(
    (scene: THREE.Scene) => {
      // Remove old mesh with fade-out
      if (sceneRef.current?.mesh) {
        const oldMesh = sceneRef.current.mesh
        // Animate opacity down then remove
        const mat = oldMesh.material as THREE.MeshPhongMaterial
        if (mat.transparent) {
          const fadeOut = () => {
            mat.opacity -= 0.05
            if (mat.opacity <= 0) {
              scene.remove(oldMesh)
              oldMesh.geometry.dispose()
              mat.dispose()
            } else {
              requestAnimationFrame(fadeOut)
              if (sceneRef.current) sceneRef.current.needsRender = true
            }
          }
          fadeOut()
        } else {
          scene.remove(oldMesh)
          oldMesh.geometry.dispose()
          mat.dispose()
        }
      }

      try {
        const data = sampleFunction3D(expression, range, resolution)
        const { grid, zRange } = data
        const rows = grid.length
        const cols = grid[0]?.length ?? 0

        if (rows < 2 || cols < 2) return

        const geometry = new THREE.BufferGeometry()
        const vertices: number[] = []
        const colors: number[] = []
        const indices: number[] = []

        const zSpan = zRange[1] - zRange[0] || 1
        const step = (range * 2) / (rows - 1)

        // Color gradient
        const colorLow = new THREE.Color('#6366f1') // indigo
        const colorMid = new THREE.Color('#06b6d4') // cyan
        const colorHigh = new THREE.Color('#f97316') // orange

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const x = -range + i * step
            const y = -range + j * step
            const z = grid[i][j]

            // Normalize z to [-1, 1] range for visualization
            const normalizedZ = ((z - zRange[0]) / zSpan) * 2 - 1
            const clampedZ = Math.max(-1, Math.min(1, normalizedZ))
            const scaledZ = clampedZ * range * 0.6

            vertices.push(x, scaledZ, y)

            // Color based on height
            const t = (clampedZ + 1) / 2
            const color = new THREE.Color()
            if (t < 0.5) {
              color.lerpColors(colorLow, colorMid, t * 2)
            } else {
              color.lerpColors(colorMid, colorHigh, (t - 0.5) * 2)
            }
            colors.push(color.r, color.g, color.b)
          }
        }

        // Build triangle indices
        for (let i = 0; i < rows - 1; i++) {
          for (let j = 0; j < cols - 1; j++) {
            const a = i * cols + j
            const b = a + cols
            const c = a + 1
            const d = b + 1
            indices.push(a, b, c)
            indices.push(c, b, d)
          }
        }

        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(vertices, 3)
        )
        geometry.setAttribute(
          'color',
          new THREE.Float32BufferAttribute(colors, 3)
        )
        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        const material = new THREE.MeshPhongMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          shininess: 60,
          transparent: true,
          opacity: 0,
        })

        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        // Add wireframe overlay
        const wireGeo = new THREE.WireframeGeometry(geometry)
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.06,
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        if (sceneRef.current) {
          sceneRef.current.mesh = mesh
          sceneRef.current.needsRender = true
        }

        // Fade-in animation
        const fadeIn = () => {
          if (material.opacity < 0.9) {
            material.opacity += 0.05
            requestAnimationFrame(fadeIn)
            if (sceneRef.current) sceneRef.current.needsRender = true
          } else {
            material.opacity = 0.9
          }
        }
        fadeIn()
      } catch (err) {
        console.error('Failed to build 3D mesh:', err)
      }
    },
    [expression, range, resolution]
  )

  // ── Axis tick labels with sprites ────────────────────────────
  const createTickLabels = useCallback((scene: THREE.Scene) => {
    const makeLabel = (text: string, position: THREE.Vector3, color: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 32
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = color
      ctx.font = '20px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 32, 16)

      const texture = new THREE.CanvasTexture(canvas)
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 })
      const sprite = new THREE.Sprite(mat)
      sprite.position.copy(position)
      sprite.scale.set(1.2, 0.6, 1)
      scene.add(sprite)
    }

    // X axis labels
    for (let i = -4; i <= 4; i += 2) {
      if (i === 0) continue
      makeLabel(String(i), new THREE.Vector3(i, -range * 0.6 - 0.4, 0), '#ef4444')
    }
    // Z axis labels (mapped to y in scene)
    for (let i = -4; i <= 4; i += 2) {
      if (i === 0) continue
      makeLabel(String(i), new THREE.Vector3(0, -range * 0.6 - 0.4, i), '#3b82f6')
    }
  }, [range])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Setup scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f172a')
    scene.fog = new THREE.Fog('#0f172a', 20, 40)

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(12, 8, 12)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // ── OrbitControls ──────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.8
    controls.zoomSpeed = 1.2
    controls.panSpeed = 0.8
    controls.minDistance = 5
    controls.maxDistance = 40
    controls.maxPolarAngle = Math.PI * 0.85
    controls.target.set(0, 0, 0)
    controls.update()

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    scene.add(directionalLight)

    const pointLight = new THREE.PointLight(0x6366f1, 0.5, 30)
    pointLight.position.set(-5, 5, -5)
    scene.add(pointLight)

    // Grid helper
    const gridHelper = new THREE.GridHelper(12, 12, 0x333366, 0x1a1a3e)
    gridHelper.position.y = -range * 0.6
    scene.add(gridHelper)

    // Axes
    const axesGroup = new THREE.Group()
    const axesMat = (color: number) =>
      new THREE.LineBasicMaterial({ color, linewidth: 2 })

    const createAxis = (
      end: THREE.Vector3,
      color: number
    ) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        end,
      ])
      return new THREE.Line(geo, axesMat(color))
    }

    axesGroup.add(createAxis(new THREE.Vector3(range, 0, 0), 0xef4444)) // X red
    axesGroup.add(createAxis(new THREE.Vector3(0, range, 0), 0x22c55e)) // Y green
    axesGroup.add(createAxis(new THREE.Vector3(0, 0, range), 0x3b82f6)) // Z blue
    scene.add(axesGroup)

    // Tick labels
    createTickLabels(scene)

    // Store refs
    sceneRef.current = {
      scene, camera, renderer, controls, mesh: null, animId: 0,
      needsRender: true,
    }

    // Build initial mesh
    buildMesh(scene)

    // ── Animation loop (render on demand) ───────────────────
    let isAnimating = true
    const animate = () => {
      if (!isAnimating) return
      const id = requestAnimationFrame(animate)
      if (sceneRef.current) sceneRef.current.animId = id

      controls.update()

      // Only render when needed (controls moved, or explicit flag)
      if (controls.enableDamping || sceneRef.current?.needsRender) {
        renderer.render(scene, camera)
        if (sceneRef.current) sceneRef.current.needsRender = false
      }
    }

    // Always render after control changes
    controls.addEventListener('change', () => {
      if (sceneRef.current) sceneRef.current.needsRender = true
    })

    animate()

    // ── Raycaster for hover coordinates ─────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      if (sceneRef.current?.mesh) {
        const intersects = raycaster.intersectObject(sceneRef.current.mesh, false)
        if (intersects.length > 0) {
          const p = intersects[0].point
          setHoverCoord(`(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`)
        } else {
          setHoverCoord('')
        }
      }
    }
    const onMouseLeave = () => setHoverCoord('')

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    // Resize
    const onResize = () => {
      if (!container || !sceneRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      sceneRef.current.camera.aspect = w / h
      sceneRef.current.camera.updateProjectionMatrix()
      sceneRef.current.renderer.setSize(w, h)
      sceneRef.current.needsRender = true
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    return () => {
      isAnimating = false
      if (sceneRef.current) cancelAnimationFrame(sceneRef.current.animId)
      controls.dispose()
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      resizeObserver.disconnect()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [buildMesh, range, createTickLabels])

  // Rebuild mesh when expression changes
  useEffect(() => {
    if (sceneRef.current) {
      buildMesh(sceneRef.current.scene)
    }
  }, [expression, buildMesh])

  return (
    <div className={`canvas-3d-container ${className}`} ref={containerRef}>
      {/* Axis labels */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] font-mono">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400">X</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-400">Y</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-blue-400">Z</span>
        </span>
      </div>

      {/* Hover coordinate */}
      {hoverCoord && (
        <div className="absolute top-3 left-3 text-[11px] font-mono text-cyan-400 bg-slate-900/80 px-2 py-1 rounded-lg backdrop-blur-sm">
          {hoverCoord}
        </div>
      )}

      {/* Interaction hint */}
      <div className="absolute top-3 right-3 text-[10px] text-slate-500 flex items-center gap-2 select-none">
        <span>🖱 旋转</span>
        <span>⚙ 缩放</span>
        <span>右键 平移</span>
      </div>
    </div>
  )
}
