import {
  computeVisibleSoilFaces,
  computeHexVisibleSoilFaces,
  computeRotatedIsoLayout,
  getSurroundingTreeIndices,
  getGridDimension,
} from '@/lib/forestLayout'
import { TREE_SPRITES, SHRUB_SPRITES, FLOWER_SPRITES } from './ForestSprites'
import { ANIMAL_SPRITES, unlockedAnimalTiers } from './AnimalSprites'
import { getVitalityShading } from '@/lib/ecoVitality'
import {
  drawHydrology,
  drawGeomorphology,
  drawSubstrateBed,
  drawRainbow,
  initWeatherParticles,
  updateWeatherParticles,
  drawWeatherParticles,
} from './forestEcosystemRenderer'

// Global shared image cache to eliminate redundant image loads
const imageCache = new Map()

export function preloadImage(src) {
  if (!src) return null
  if (imageCache.has(src)) return imageCache.get(src)
  if (typeof window === 'undefined') return null

  const img = new Image()
  img.src = src
  img.crossOrigin = 'anonymous'
  imageCache.set(src, img)
  return img
}

export function isImageLoaded(img) {
  return img && img.complete && img.naturalWidth > 0
}

/**
 * ForestCanvasEngine
 * High-performance 2.5D/3D Isometric rendering and physics engine.
 */
export class ForestCanvasEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.options = {
      interactive: true,
      showWildlife: true,
      isHex: false,
      ecosystem: null,
      ...options,
    }

    this.ecosystem = this.options.ecosystem || null
    this.isHex = Boolean(this.options.isHex)

    // Camera transform
    this.camera = {
      yaw: Math.PI * 0.25, // Start at isometric 45° angle
      targetYaw: Math.PI * 0.25,
      pitch: 0.5236, // ~30° tilt
      zoom: 1.0,
      targetZoom: 1.0,
      panX: 0,
      panY: 0,
      autoRotate: false,
    }

    // Weather & seasonal particles
    this.particles = []
    this.weatherType = this.resolveWeatherType()
    if (this.weatherType) {
      this.particles = initWeatherParticles(32, this.weatherType)
    }

    // Viewport dimensions
    this.width = 0
    this.height = 0
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    // Items & simulation state
    this.items = []
    this.layoutCells = []
    this.grid = 1
    this.animals = []
    this.hoveredItemIndex = null
    this.xRayNeighbors = []
    this.onHoverChange = null
    this.lastFrameTime = performance.now()
    this.animFrameId = null
    this.destroyed = false

    // Initial asset preloading
    this.preloadKeyAssets()
  }

  preloadKeyAssets() {
    // Warm up commonly used trees, shrubs, flowers
    TREE_SPRITES.slice(0, 8).forEach((s) => preloadImage(s.src))
    SHRUB_SPRITES.slice(0, 6).forEach((s) => preloadImage(s.src))
    FLOWER_SPRITES.slice(0, 6).forEach((s) => preloadImage(s.src))
    ANIMAL_SPRITES.slice(0, 10).forEach((s) => preloadImage(s.src))
  }

  setDimensions(width, height) {
    if (width <= 0 || height <= 0) return
    this.width = width
    this.height = height
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.requestRender()
  }

  resolveWeatherType() {
    if (!this.ecosystem) return null
    const seasonId = this.ecosystem.climate?.season?.id
    const weatherEffect = this.ecosystem.weather?.effect

    if (weatherEffect === 'rain' || seasonId === 'varsha') return 'rain'
    if (seasonId === 'shishir') return 'snow'
    if (seasonId === 'vasant') return 'petals'
    if (seasonId === 'sharad') return 'leaves'
    if (seasonId === 'grishma') return 'dust'
    return null
  }

  setEcosystem(ecosystem) {
    this.ecosystem = ecosystem
    const nextWeather = this.resolveWeatherType()
    if (nextWeather !== this.weatherType) {
      this.weatherType = nextWeather
      this.particles = nextWeather ? initWeatherParticles(32, nextWeather) : []
    }
    this.requestRender()
  }

  setItems(items = []) {
    this.items = items
    const n = items.length
    this.grid = getGridDimension(n)

    // Preload image assets for these items
    for (let i = 0; i < Math.min(n, 120); i++) {
      const item = items[i]
      const sprite = this.resolveSprite(item)
      if (sprite?.src) preloadImage(sprite.src)
    }

    // Initialize or reconcile roaming wildlife on grass tiles
    this.reconcileWildlife()
    this.requestRender()
  }

  reconcileWildlife() {
    if (!this.options.showWildlife || this.items.length < 5) {
      this.animals = []
      return
    }

    const tiers = unlockedAnimalTiers(this.items.length)
    if (tiers.length === 0) {
      this.animals = []
      return
    }

    const pool = ANIMAL_SPRITES.filter((a) => tiers.includes(a.tier))
    const maxCount = tiers.includes('large') ? 4 : tiers.includes('medium') ? 3 : 2
    const targetCount = Math.min(maxCount, pool.length)

    // Keep existing animals if possible, add new ones if needed
    const current = [...this.animals]
    while (current.length < targetCount) {
      const animalMeta = pool[current.length % pool.length]
      preloadImage(animalMeta.src)
      const x0 = (Math.random() - 0.5) * 1.4 // [-0.7, 0.7] on normalized terrain
      const z0 = (Math.random() - 0.5) * 1.4
      current.push({
        id: `${animalMeta.id}-${current.length}`,
        meta: animalMeta,
        src: animalMeta.src,
        h: animalMeta.h || 32,
        x0,
        z0,
        targetX: x0 + (Math.random() - 0.5) * 0.4,
        targetZ: z0 + (Math.random() - 0.5) * 0.4,
        speed: 0.08 + Math.random() * 0.08,
        state: 'walking', // 'walking' | 'grazing'
        waitSec: 1 + Math.random() * 2,
        facing: Math.random() > 0.5 ? 1 : -1,
        bobOffset: Math.random() * Math.PI * 2,
      })
    }

    this.animals = current.slice(0, targetCount)
  }

  resolveSprite(item) {
    if (!item) return null
    if (item.type === 'flower') {
      const pool = FLOWER_SPRITES
      const idx = Math.abs((item.seed || 0) % pool.length)
      return pool[idx]
    }
    if (item.type === 'shrub') {
      const pool = SHRUB_SPRITES
      const idx = Math.abs((item.seed || 0) % pool.length)
      return pool[idx]
    }
    // Tree
    const pool = TREE_SPRITES
    const idx = Math.abs((item.seed || 0) % pool.length)
    return pool[idx]
  }

  // Camera & view controls
  rotateBy(deltaYaw) {
    this.camera.targetYaw = (this.camera.targetYaw + deltaYaw) % (Math.PI * 2)
    if (this.camera.targetYaw < 0) this.camera.targetYaw += Math.PI * 2
    this.requestRender()
  }

  setYaw(yaw) {
    this.camera.targetYaw = yaw % (Math.PI * 2)
    if (this.camera.targetYaw < 0) this.camera.targetYaw += Math.PI * 2
    this.requestRender()
  }

  zoomBy(deltaZoom, focalX = null, focalY = null) {
    const prevZoom = this.camera.targetZoom
    const nextZoom = Math.max(0.35, Math.min(3.8, prevZoom * deltaZoom))
    const ratio = nextZoom / prevZoom

    if (focalX !== null && focalY !== null && this.width > 0 && this.height > 0) {
      // Focal zoom towards custom point (e.g. edge inspection via Ctrl + wheel)
      this.camera.panX = (this.camera.panX - (focalX - this.width / 2)) * ratio + (focalX - this.width / 2)
      this.camera.panY = (this.camera.panY - (focalY - this.height / 2)) * ratio + (focalY - this.height / 2)
    }

    this.camera.targetZoom = nextZoom
    this.requestRender()
  }

  panBy(dx, dy) {
    this.camera.panX += dx
    this.camera.panY += dy
    this.requestRender()
  }

  resetView() {
    this.camera.targetYaw = Math.PI * 0.25 // Standard isometric 45°
    this.camera.targetZoom = 1.0
    this.camera.panX = 0
    this.camera.panY = 0
    this.requestRender()
  }

  toggleAutoRotate() {
    this.camera.autoRotate = !this.camera.autoRotate
    if (this.camera.autoRotate) {
      this.startLoop()
    }
  }

  // Hover detection & X-ray peeking
  handlePointerMove(screenX, screenY) {
    if (this.items.length === 0 || !this.lastDrawData) {
      this.setHovered(null)
      return
    }

    const { entities } = this.lastDrawData
    let found = null

    // Hit-test entities in reverse depth order (front-most entity checked first)
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i]
      if (ent.kind !== 'plant') continue

      const halfW = ent.w / 2
      const topY = ent.y - ent.h
      const botY = ent.y + 4

      if (screenX >= ent.x - halfW && screenX <= ent.x + halfW && screenY >= topY && screenY <= botY) {
        found = ent
        break
      }
    }

    if (found) {
      this.setHovered(found.itemIndex)
    } else {
      this.setHovered(null)
    }
  }

  setHovered(itemIndex) {
    if (this.hoveredItemIndex === itemIndex) return
    this.hoveredItemIndex = itemIndex

    if (itemIndex !== null && this.layoutCells.length > 0) {
      // Find 2-3 surrounding neighbor trees to fade out (X-Ray effect)
      this.xRayNeighbors = getSurroundingTreeIndices(this.layoutCells, itemIndex, 1.8)
    } else {
      this.xRayNeighbors = []
    }

    if (this.onHoverChange) {
      const item = itemIndex !== null ? this.items[itemIndex] : null
      this.onHoverChange(item)
    }
    this.requestRender()
  }

  // Simulation step (wildlife movement & camera smoothing)
  updateSimulation(dt) {
    // Camera damping using shortest angular arc
    let cameraMoving = false
    let yawDiff = (this.camera.targetYaw - this.camera.yaw) % (Math.PI * 2)
    if (yawDiff > Math.PI) yawDiff -= Math.PI * 2
    if (yawDiff < -Math.PI) yawDiff += Math.PI * 2

    if (Math.abs(yawDiff) > 0.001) {
      this.camera.yaw += yawDiff * Math.min(1, dt * 14)
      cameraMoving = true
    } else {
      this.camera.yaw = this.camera.targetYaw
    }

    const zoomDiff = this.camera.targetZoom - this.camera.zoom
    if (Math.abs(zoomDiff) > 0.001) {
      this.camera.zoom += zoomDiff * Math.min(1, dt * 16)
      cameraMoving = true
    } else {
      this.camera.zoom = this.camera.targetZoom
    }

    if (this.camera.autoRotate) {
      this.camera.targetYaw = (this.camera.targetYaw - dt * 0.18) % (Math.PI * 2)
      if (this.camera.targetYaw < 0) this.camera.targetYaw += Math.PI * 2
      cameraMoving = true
    }

    // Wildlife roaming inside forest bounds
    let animalsMoving = false
    if (this.animals.length > 0) {
      for (const animal of this.animals) {
        if (animal.state === 'walking') {
          const dx = animal.targetX - animal.x0
          const dz = animal.targetZ - animal.z0
          const dist = Math.sqrt(dx * dx + dz * dz)

          if (dist < 0.03) {
            animal.state = 'grazing'
            animal.waitSec = 2 + Math.random() * 4
          } else {
            const step = Math.min(dist, animal.speed * dt)
            animal.x0 += (dx / dist) * step
            animal.z0 += (dz / dist) * step
            animal.facing = dx >= 0 ? 1 : -1
            animal.bobOffset += dt * 10
            animalsMoving = true
          }
        } else if (animal.state === 'grazing') {
          animal.waitSec -= dt
          if (animal.waitSec <= 0) {
            // Pick a new waypoint on the grass plot (bounded within [-0.75, 0.75])
            animal.targetX = (Math.random() - 0.5) * 1.5
            animal.targetZ = (Math.random() - 0.5) * 1.5
            animal.state = 'walking'
            animalsMoving = true
          }
        }
      }
    }

    // Weather particles update
    let weatherActive = false
    if (this.particles.length > 0 && this.weatherType) {
      updateWeatherParticles(this.particles, dt, this.weatherType)
      weatherActive = true
    }

    return cameraMoving || animalsMoving || weatherActive
  }

  requestRender() {
    if (this.destroyed) return
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame((now) => this.renderFrame(now))
    }
  }

  startLoop() {
    if (this.destroyed) return
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame((now) => this.renderFrame(now))
    }
  }

  renderFrame(now) {
    this.animFrameId = null
    if (this.destroyed || this.width <= 0 || this.height <= 0) return

    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000)
    this.lastFrameTime = now

    const stillActive = this.updateSimulation(dt)

    this.draw()

    if (stillActive || this.camera.autoRotate || this.animals.length > 0 || this.particles.length > 0) {
      this.requestRender()
    }
  }

  draw() {
    const { ctx, width, height, dpr } = this
    if (!ctx || width <= 0 || height <= 0) return

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const zoom = this.camera.zoom
    const yaw = this.camera.yaw
    const pitch = this.camera.pitch
    const sinPitch = Math.sin(pitch)

    const totalPlants = this.items.length
    const grid = this.grid || 1

    // Plot radius scaling based on grid:
    // Expands smoothly as more trees are added (from small plot to massive grove)
    const baseRadius = Math.min(width * 0.44, height * 0.40)
    const growthScale = totalPlants <= 1
      ? 0.65
      : totalPlants <= 5
      ? 0.70 + (totalPlants - 1) * 0.04
      : Math.min(1.35, 0.78 + Math.min(grid, 25) * 0.024)
    const R = Math.max(28, baseRadius * growthScale * zoom)
    const soilDepth = Math.max(18, R * 0.22)

    // Center the 3D diorama visually (offsetting downward extruded soil depth)
    const cx = width / 2 + this.camera.panX
    const cy = height / 2 - soilDepth * 0.35 + this.camera.panY

    // Compute layout for current yaw angle
    const layout = computeRotatedIsoLayout(totalPlants, { yaw, pitch, maxCells: 10000 })
    this.layoutCells = layout.cells

    // ── 1. Floor Ground Shadow ────────────────────────────────────────────────
    const shadowRx = R * 1.35
    const shadowRy = R * sinPitch * 1.25
    const shadowCy = cy + soilDepth + R * sinPitch * 0.35

    const shadowGrad = ctx.createRadialGradient(cx, shadowCy, shadowRx * 0.1, cx, shadowCy, shadowRx)
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.42)')
    shadowGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.18)')
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2)
    ctx.fillStyle = shadowGrad
    ctx.fill()
    ctx.restore()

    // ── 2. Extruded 3D Soil Side Faces (Rhombus or Hex) ──────────────────────
    const isHex = Boolean(this.isHex)
    const vitality = this.ecosystem?.vitality ?? 1.0
    const { warmTint, waterAlpha } = getVitalityShading(vitality)
    const tierLevel = this.ecosystem?.tier?.level ?? (totalPlants > 0 ? 3 : 0)
    const seasonId = this.ecosystem?.climate?.season?.id
    const timeSec = performance.now() * 0.001

    const { corners, visibleFaces } = isHex
      ? computeHexVisibleSoilFaces(yaw)
      : computeVisibleSoilFaces(yaw)

    // Projected corners on screen
    const screenCorners = corners.map((c) => ({
      x: cx + c.rx * R,
      y: cy + c.rz * R * sinPitch,
    }))

    // Draw visible soil walls
    for (const face of visibleFaces) {
      const c0 = screenCorners[face.startIndex]
      const c1 = screenCorners[face.endIndex]

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(c0.x, c0.y)
      ctx.lineTo(c1.x, c1.y)
      ctx.lineTo(c1.x, c1.y + soilDepth)
      ctx.lineTo(c0.x, c0.y + soilDepth)
      ctx.closePath()

      // Shaded soil gradient based on directional sunlight
      const light = face.lightFactor
      const soilGrad = ctx.createLinearGradient(c0.x, c0.y, c1.x, c1.y + soilDepth)
      const rVal = Math.round(55 + light * 45)
      const gVal = Math.round(34 + light * 32)
      const bVal = Math.round(18 + light * 18)
      soilGrad.addColorStop(0, `rgb(${rVal}, ${gVal}, ${bVal})`)
      soilGrad.addColorStop(1, `rgb(${Math.round(rVal * 0.5)}, ${Math.round(gVal * 0.5)}, ${Math.round(bVal * 0.5)})`)

      ctx.fillStyle = soilGrad
      ctx.fill()

      // Horizontal geological sediment strata bands
      if (soilDepth > 14) {
        ctx.strokeStyle = 'rgba(25, 12, 4, 0.45)'
        ctx.lineWidth = 1.2
        const strataRatios = [0.35, 0.72]
        for (const sr of strataRatios) {
          ctx.beginPath()
          ctx.moveTo(c0.x, c0.y + soilDepth * sr)
          ctx.quadraticCurveTo(
            (c0.x + c1.x) / 2,
            (c0.y + c1.y) / 2 + soilDepth * sr + 2,
            c1.x,
            c1.y + soilDepth * sr,
          )
          ctx.stroke()
        }
      }

      ctx.restore()
    }

    // Vertical soil seams between corners
    ctx.save()
    ctx.strokeStyle = 'rgba(20, 10, 3, 0.55)'
    ctx.lineWidth = 1.5
    for (const c of screenCorners) {
      ctx.beginPath()
      ctx.moveTo(c.x, c.y)
      ctx.lineTo(c.x, c.y + soilDepth)
      ctx.stroke()
    }
    ctx.restore()

    // ── 3. Top Face Polygon (Substrate, Vitality & Season Graded Grass) ─────────
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(screenCorners[0].x, screenCorners[0].y)
    for (let i = 1; i < screenCorners.length; i++) {
      ctx.lineTo(screenCorners[i].x, screenCorners[i].y)
    }
    ctx.closePath()

    if (totalPlants === 0 && tierLevel === 0) {
      // Day 1 Bare Substrate bed
      drawSubstrateBed(ctx, { cx, cy, R, sinPitch, yaw, screenCorners })
    } else {
      // Vitality & Seasonal Graded Grass
      const grassGrad = ctx.createLinearGradient(cx, cy - R * sinPitch, cx, cy + R * sinPitch)
      if (warmTint > 0.15) {
        // Parched savannah
        grassGrad.addColorStop(0, '#c7ab4e')
        grassGrad.addColorStop(0.5, '#99842c')
        grassGrad.addColorStop(1, '#5e5118')
      } else if (seasonId === 'shishir') {
        // Winter frost
        grassGrad.addColorStop(0, '#a5dfd0')
        grassGrad.addColorStop(0.5, '#4ea78f')
        grassGrad.addColorStop(1, '#2c6d5c')
      } else if (seasonId === 'grishma') {
        // Summer warm olive
        grassGrad.addColorStop(0, '#b8ca43')
        grassGrad.addColorStop(0.5, '#7f9923')
        grassGrad.addColorStop(1, '#4e6112')
      } else if (seasonId === 'sharad') {
        // Autumn amber
        grassGrad.addColorStop(0, '#d1b945')
        grassGrad.addColorStop(0.5, '#968123')
        grassGrad.addColorStop(1, '#544611')
      } else {
        // Lush emerald
        grassGrad.addColorStop(0, '#94ea48')
        grassGrad.addColorStop(0.45, '#5ec734')
        grassGrad.addColorStop(1, '#3ca422')
      }
      ctx.fillStyle = grassGrad
      ctx.fill()

      // Subtle sunlit sheen
      const sheenGrad = ctx.createRadialGradient(cx, cy - R * sinPitch * 0.3, 0, cx, cy, R)
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = sheenGrad
      ctx.fill()

      // Subtle isometric tile grid lines (only on square plots)
      if (!isHex && grid > 1 && grid <= 36) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
        ctx.lineWidth = 0.75
        const cosYaw = Math.cos(yaw)
        const sinYaw = Math.sin(yaw)

        for (let g = 1; g < grid; g++) {
          const u = (g / grid) * 2 - 1
          const xA = u * cosYaw - -1 * sinYaw
          const zA = u * sinYaw + -1 * cosYaw
          const xB = u * cosYaw - 1 * sinYaw
          const zB = u * sinYaw + 1 * cosYaw

          ctx.beginPath()
          ctx.moveTo(cx + xA * R, cy + zA * R * sinPitch)
          ctx.lineTo(cx + xB * R, cy + zB * R * sinPitch)
          ctx.stroke()

          const xC = -1 * cosYaw - u * sinYaw
          const zC = -1 * sinYaw + u * cosYaw
          const xD = 1 * cosYaw - u * sinYaw
          const zD = 1 * sinYaw + u * cosYaw

          ctx.beginPath()
          ctx.moveTo(cx + xC * R, cy + zC * R * sinPitch)
          ctx.lineTo(cx + xD * R, cy + zD * R * sinPitch)
          ctx.stroke()
        }
      }
    }

    // Jagged grass fringe along front-facing edges
    ctx.fillStyle = warmTint > 0.15 ? '#99842c' : '#4da92c'
    ctx.strokeStyle = 'rgba(20, 10, 3, 0.3)'
    ctx.lineWidth = 1

    for (const face of visibleFaces) {
      const c0 = screenCorners[face.startIndex]
      const c1 = screenCorners[face.endIndex]
      const steps = Math.min(24, Math.max(8, Math.round(R * 0.12)))
      const toothH = Math.max(3, Math.min(8, soilDepth * 0.22))

      ctx.beginPath()
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps
        const t1 = (s + 1) / steps
        const tM = (t0 + t1) / 2

        const p0x = c0.x + (c1.x - c0.x) * t0
        const p0y = c0.y + (c1.y - c0.y) * t0
        const p1x = c0.x + (c1.x - c0.x) * t1
        const p1y = c0.y + (c1.y - c0.y) * t1
        const tipX = c0.x + (c1.x - c0.x) * tM
        const tipY = c0.y + (c1.y - c0.y) * tM + toothH

        ctx.moveTo(p0x, p0y)
        ctx.lineTo(p1x, p1y)
        ctx.lineTo(tipX, tipY)
        ctx.closePath()
      }
      ctx.fill()
    }
    ctx.restore()

    // Geomorphological Elevation (Hills, ridges, cliffs)
    if (this.ecosystem?.geomorphology?.type) {
      drawGeomorphology(ctx, {
        cx,
        cy,
        R,
        sinPitch,
        yaw,
        type: this.ecosystem.geomorphology.type,
        soilDepth,
      })
    }

    // Hydrological Water Bodies (Puddle, pond, stream, river, waterfall)
    if (this.ecosystem?.hydrology?.type) {
      drawHydrology(ctx, {
        cx,
        cy,
        R,
        sinPitch,
        yaw,
        type: this.ecosystem.hydrology.type,
        waterAlpha,
        time: timeSec,
      })
    }

    // Climax Rainbow Arc (Tier 5)
    if (tierLevel >= 5) {
      drawRainbow(ctx, { cx, cy, R, sinPitch })
    }

    // ── 4. Depth-Sorted Entities (Flora & Roaming Animals) ──────────────────────
    const entities = []

    // Base tree size scales with grid and zoom
    const tileSize = (R * 2) / Math.max(2, grid)
    const baseTreeH = Math.max(16, Math.min(160, tileSize * 1.65 * zoom))

    // Collect flora entities
    const isMassive = totalPlants > 400 && zoom < 1.0
    for (const cell of layout.cells) {
      const item = this.items[cell.index]
      if (!item) continue

      // Inset so plants don't hang off the edge
      const INSET = 0.88
      const px = cx + cell.rx * R * INSET
      const py = cy + cell.rz * R * sinPitch * INSET

      // Frustum culling: skip if entirely outside visible canvas
      if (px < -100 || px > width + 100 || py < -100 || py > height + 100) {
        continue
      }

      let entH = baseTreeH * cell.scale
      if (item.type === 'flower') entH *= 0.45
      else if (item.type === 'shrub') entH *= 0.6

      entities.push({
        kind: 'plant',
        depth: cell.depth,
        x: px,
        y: py,
        h: Math.round(entH),
        w: Math.round(entH * 0.9),
        item,
        itemIndex: cell.index,
        isMassive,
      })
    }

    // Collect roaming animal entities
    const cosYaw = Math.cos(yaw)
    const sinYaw = Math.sin(yaw)
    for (const animal of this.animals) {
      const rx = animal.x0 * cosYaw - animal.z0 * sinYaw
      const rz = animal.x0 * sinYaw + animal.z0 * cosYaw
      const px = cx + rx * R * 0.84
      const py = cy + rz * R * sinPitch * 0.84

      const bobY = Math.sin(animal.bobOffset) * 2.5
      const animalH = Math.max(14, animal.h * (baseTreeH / 88) * 1.1)

      entities.push({
        kind: 'animal',
        depth: rz,
        x: px,
        y: py + bobY,
        h: Math.round(animalH),
        w: Math.round(animalH * 1.1),
        animal,
      })
    }

    // Sort strictly back-to-front by depth (lowest depth first)
    entities.sort((a, b) => a.depth - b.depth)
    this.lastDrawData = { entities, cx, cy, R }

    // ── 5. Render Entities ────────────────────────────────────────────────────
    const hoveredIdx = this.hoveredItemIndex
    const xRayNeighbors = this.xRayNeighbors

    for (const ent of entities) {
      if (ent.kind === 'plant') {
        const isHovered = ent.itemIndex === hoveredIdx
        const isOccludedNeighbor = xRayNeighbors.includes(ent.itemIndex)

        ctx.save()

        // X-Ray Peeking Effect: Neighbor trees fade out to 0.08 opacity
        if (isOccludedNeighbor) {
          ctx.globalAlpha = 0.08
        } else if (hoveredIdx !== null && !isHovered) {
          ctx.globalAlpha = 0.88
        } else {
          ctx.globalAlpha = 1.0
        }

        // Contact ground shadow
        const shadowW = ent.w * 0.65
        const shadowH = Math.max(2.5, shadowW * 0.26)
        ctx.beginPath()
        ctx.ellipse(ent.x, ent.y, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fill()

        if (ent.isMassive) {
          // LOD: Ultra-fast canopy cluster for massive forests
          ctx.beginPath()
          ctx.arc(ent.x, ent.y - ent.h * 0.5, ent.h * 0.45, 0, Math.PI * 2)
          ctx.fillStyle = ent.item.type === 'flower' ? '#f43f5e' : ent.item.type === 'shrub' ? '#10b981' : '#059669'
          ctx.fill()
        } else {
          // Full crisp sprite
          const sprite = this.resolveSprite(ent.item)
          const img = sprite?.src ? preloadImage(sprite.src) : null

          if (isImageLoaded(img)) {
            const aspect = sprite.aspect || img.naturalWidth / img.naturalHeight || 1
            const drawW = ent.h * aspect
            const drawX = ent.x - drawW / 2
            const drawY = ent.y - ent.h

            // Hover glow ring
            if (isHovered) {
              ctx.shadowColor = 'rgba(16, 185, 129, 0.95)'
              ctx.shadowBlur = 16
            }

            ctx.drawImage(img, drawX, drawY, drawW, ent.h)
          } else {
            // Fallback while loading
            ctx.beginPath()
            ctx.arc(ent.x, ent.y - ent.h * 0.5, ent.h * 0.35, 0, Math.PI * 2)
            ctx.fillStyle = '#10b981'
            ctx.fill()
          }
        }

        ctx.restore()
      } else if (ent.kind === 'animal') {
        // Roaming Animal
        ctx.save()
        ctx.globalAlpha = 1.0

        // Contact ground shadow
        const shadowW = ent.w * 0.6
        const shadowH = Math.max(2.5, shadowW * 0.25)
        ctx.beginPath()
        ctx.ellipse(ent.x, ent.y, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.fill()

        const img = preloadImage(ent.animal.src)
        if (isImageLoaded(img)) {
          const drawW = ent.h * (img.naturalWidth / img.naturalHeight || 1)
          const drawH = ent.h
          const drawY = ent.y - drawH

          ctx.save()
          ctx.translate(ent.x, 0)
          if (ent.animal.facing < 0) {
            ctx.scale(-1, 1)
          }
          ctx.drawImage(img, -drawW / 2, drawY, drawW, drawH)
          ctx.restore()
        }

        ctx.restore()
      }
    }

    // Atmospheric Weather & Seasonal particles
    if (this.particles.length > 0 && this.weatherType) {
      drawWeatherParticles(ctx, this.particles, width, height, this.weatherType)
    }

    ctx.restore()
  }

  destroy() {
    this.destroyed = true
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }
}
