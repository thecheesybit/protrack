/**
 * forestEcosystemRenderer.js — Canvas drawing routines for Living Forest Ecosystem.
 *
 * Renders:
 *  1. Hydrology (puddle, pond, winding stream, meandering river, alpine waterfall)
 *  2. Geomorphology (hillock, rolling hills, rocky peaks, towering cliffs)
 *  3. Day 1 Substrate (tilled soil, baby sprouts, mineral formations)
 *  4. Weather particles (monsoon rain, spring blossoms, winter snow, autumn leaves, fireflies)
 *
 * All ground features rotate in true 3D isometric space with camera yaw.
 */

// Helper: rotate normalized ground coordinate (gx, gz) by camera yaw and project to screen
export function projectGround(gx, gz, { cx, cy, R, sinPitch, cosYaw, sinYaw, elevY = 0 }) {
  const rx = gx * cosYaw - gz * sinYaw
  const rz = gx * sinYaw + gz * cosYaw
  return {
    x: cx + rx * R,
    y: cy + rz * R * sinPitch - elevY,
    rx,
    rz,
    depth: rz,
  }
}

/**
 * ── 1. Hydrological Features ─────────────────────────────────────────────────
 */
export function drawHydrology(ctx, { cx, cy, R, sinPitch, yaw, type, waterAlpha = 1.0, time = 0 }) {
  if (!type || type === 'none') return

  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const proj = (gx, gz, elevY = 0) =>
    projectGround(gx, gz, { cx, cy, R, sinPitch, cosYaw, sinYaw, elevY })

  ctx.save()

  // Dynamic shimmer pulse
  const shimmer = Math.sin(time * 2.5) * 0.12 + 0.88
  const alpha = Math.max(0.2, Math.min(1.0, waterAlpha * shimmer))

  if (type === 'puddle') {
    // Tier 1: Small sparkling dew puddle near center
    const center = proj(0.18, 0.12)
    const radX = Math.max(8, R * 0.12)
    const radY = Math.max(4, radX * sinPitch * 0.85)

    // Water reflection gradient
    const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radX)
    grad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 0.95})`)
    grad.addColorStop(0.65, `rgba(14, 165, 233, ${alpha * 0.75})`)
    grad.addColorStop(1, `rgba(2, 132, 199, ${alpha * 0.2})`)

    ctx.beginPath()
    ctx.ellipse(center.x, center.y, radX, radY, yaw * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Shimmer ring
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * alpha})`
    ctx.lineWidth = 1.2
    ctx.stroke()
  } else if (type === 'pond') {
    // Tier 2: Blue oval pond with lily pads
    const pCenter = proj(0.22, 0.2)
    const prx = Math.max(16, R * 0.22)
    const pry = Math.max(8, prx * sinPitch * 0.85)

    // Sandy/pebble shore
    ctx.beginPath()
    ctx.ellipse(pCenter.x, pCenter.y, prx * 1.14, pry * 1.14, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217, 180, 130, 0.45)'
    ctx.fill()

    // Water gradient
    const grad = ctx.createRadialGradient(pCenter.x, pCenter.y, prx * 0.1, pCenter.x, pCenter.y, prx)
    grad.addColorStop(0, `rgba(56, 189, 248, ${alpha})`)
    grad.addColorStop(0.7, `rgba(2, 132, 199, ${alpha * 0.9})`)
    grad.addColorStop(1, `rgba(3, 105, 161, ${alpha * 0.75})`)

    ctx.beginPath()
    ctx.ellipse(pCenter.x, pCenter.y, prx, pry, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Water ripple ring
    const ripR = prx * (0.45 + (Math.sin(time * 1.8) * 0.5 + 0.5) * 0.35)
    ctx.beginPath()
    ctx.ellipse(pCenter.x, pCenter.y, ripR, ripR * sinPitch, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * alpha})`
    ctx.lineWidth = 1
    ctx.stroke()

    // 2 Lily pads
    const pad1 = proj(0.28, 0.16)
    ctx.beginPath()
    ctx.ellipse(pad1.x, pad1.y, prx * 0.22, prx * 0.12 * sinPitch, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#10b981'
    ctx.fill()
    // Lily blossom
    ctx.beginPath()
    ctx.arc(pad1.x, pad1.y - 1, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#f472b6'
    ctx.fill()
  } else if (type === 'stream') {
    // Tier 3: Winding brook curving from back-left across center to front-right
    const pts = [
      proj(-0.45, -0.42),
      proj(-0.2, -0.2),
      proj(0.05, 0.05),
      proj(0.3, 0.25),
      proj(0.48, 0.45),
    ]

    const streamW = Math.max(6, R * 0.075)

    // Sandy gravel bed
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const mx = (prev.x + curr.x) / 2
      const my = (prev.y + curr.y) / 2
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.strokeStyle = 'rgba(217, 180, 130, 0.55)'
    ctx.lineWidth = streamW + 4
    ctx.lineCap = 'round'
    ctx.stroke()

    // Flowing water ribbon
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const mx = (prev.x + curr.x) / 2
      const my = (prev.y + curr.y) / 2
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.88})`
    ctx.lineWidth = streamW
    ctx.stroke()

    // Foam currents
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * alpha})`
    ctx.lineWidth = streamW * 0.35
    ctx.setLineDash([6, 12])
    ctx.lineDashOffset = -time * 24
    ctx.stroke()
    ctx.setLineDash([])
  } else if (type === 'river') {
    // Tier 4: Meandering river with stone crossing
    const pts = [
      proj(-0.55, -0.3),
      proj(-0.15, -0.05),
      proj(0.18, 0.08),
      proj(0.42, 0.38),
      proj(0.6, 0.52),
    ]

    const riverW = Math.max(14, R * 0.14)

    // Riverbed
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.strokeStyle = 'rgba(180, 150, 110, 0.65)'
    ctx.lineWidth = riverW + 6
    ctx.lineCap = 'round'
    ctx.stroke()

    // Deep water
    ctx.strokeStyle = `rgba(2, 132, 199, ${alpha * 0.92})`
    ctx.lineWidth = riverW
    ctx.stroke()

    // Wave ripples
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * alpha})`
    ctx.lineWidth = riverW * 0.28
    ctx.setLineDash([10, 18])
    ctx.lineDashOffset = -time * 30
    ctx.stroke()
    ctx.setLineDash([])

    // Stepping stones crossing the river at center
    const stonePts = [proj(0.02, 0.01), proj(0.08, 0.05), proj(0.14, 0.09)]
    for (const s of stonePts) {
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, 4.5, 2.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#64748b'
      ctx.fill()
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  } else if (type === 'waterfall') {
    // Tier 5: Alpine lake + plunging waterfall from rear cliff
    const lakeCenter = proj(0.15, 0.25)
    const lrx = Math.max(28, R * 0.32)
    const lry = Math.max(14, lrx * sinPitch * 0.9)

    // Shoreline
    ctx.beginPath()
    ctx.ellipse(lakeCenter.x, lakeCenter.y, lrx * 1.12, lry * 1.12, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(180, 150, 110, 0.55)'
    ctx.fill()

    // Deep turquoise alpine water
    const lakeGrad = ctx.createRadialGradient(lakeCenter.x, lakeCenter.y, 0, lakeCenter.x, lakeCenter.y, lrx)
    lakeGrad.addColorStop(0, `rgba(56, 189, 248, ${alpha})`)
    lakeGrad.addColorStop(0.5, `rgba(13, 148, 136, ${alpha * 0.95})`)
    lakeGrad.addColorStop(1, `rgba(15, 118, 110, ${alpha * 0.85})`)

    ctx.beginPath()
    ctx.ellipse(lakeCenter.x, lakeCenter.y, lrx, lry, 0, 0, Math.PI * 2)
    ctx.fillStyle = lakeGrad
    ctx.fill()

    // Waterfall cascade from rear elevation
    const cliffTop = proj(-0.25, -0.45, R * 0.38)
    const fallBase = proj(-0.15, -0.05, 0)
    const fallW = Math.max(10, R * 0.08)

    // Foaming vertical water torrent
    const fallGrad = ctx.createLinearGradient(cliffTop.x, cliffTop.y, fallBase.x, fallBase.y)
    fallGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)')
    fallGrad.addColorStop(0.5, `rgba(186, 230, 253, ${alpha})`)
    fallGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)')

    ctx.beginPath()
    ctx.moveTo(cliffTop.x - fallW / 2, cliffTop.y)
    ctx.lineTo(cliffTop.x + fallW / 2, cliffTop.y)
    ctx.lineTo(fallBase.x + fallW * 0.8, fallBase.y)
    ctx.lineTo(fallBase.x - fallW * 0.8, fallBase.y)
    ctx.closePath()
    ctx.fillStyle = fallGrad
    ctx.fill()

    // Waterfall mist & spray particles at base
    const mistR = fallW * (1.2 + Math.sin(time * 6) * 0.25)
    ctx.beginPath()
    ctx.ellipse(fallBase.x, fallBase.y + 2, mistR, mistR * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.fill()
  }

  ctx.restore()
}

/**
 * ── 2. Geomorphological Features ─────────────────────────────────────────────
 */
export function drawGeomorphology(ctx, { cx, cy, R, sinPitch, yaw, type, _soilDepth = 20 }) {
  if (!type || type === 'flat') return

  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const proj = (gx, gz, elevY = 0) =>
    projectGround(gx, gz, { cx, cy, R, sinPitch, cosYaw, sinYaw, elevY })

  ctx.save()

  if (type === 'hillock') {
    // Tier 2: Gentle grassy hillock in rear quadrant
    const hillBase = proj(-0.35, -0.35)
    const hillH = Math.max(10, R * 0.12)
    const hillW = Math.max(22, R * 0.26)

    ctx.beginPath()
    ctx.moveTo(hillBase.x - hillW / 2, hillBase.y)
    ctx.quadraticCurveTo(hillBase.x, hillBase.y - hillH, hillBase.x + hillW / 2, hillBase.y)
    ctx.closePath()

    const grad = ctx.createLinearGradient(hillBase.x - hillW / 2, hillBase.y - hillH, hillBase.x + hillW / 2, hillBase.y)
    grad.addColorStop(0, '#7ecc3a')
    grad.addColorStop(0.5, '#56b82c')
    grad.addColorStop(1, '#3b911e')
    ctx.fillStyle = grad
    ctx.fill()
  } else if (type === 'rolling_hills') {
    // Tier 3: Two rolling background hills
    const hills = [
      { gx: -0.45, gz: -0.38, w: R * 0.32, h: R * 0.16 },
      { gx: -0.15, gz: -0.5, w: R * 0.28, h: R * 0.14 },
    ]

    for (const h of hills) {
      const base = proj(h.gx, h.gz)
      ctx.beginPath()
      ctx.moveTo(base.x - h.w / 2, base.y)
      ctx.quadraticCurveTo(base.x, base.y - h.h, base.x + h.w / 2, base.y)
      ctx.closePath()

      const grad = ctx.createLinearGradient(base.x - h.w / 2, base.y - h.h, base.x + h.w / 2, base.y)
      grad.addColorStop(0, '#82d33e')
      grad.addColorStop(0.5, '#58bb2d')
      grad.addColorStop(1, '#388e1c')
      ctx.fillStyle = grad
      ctx.fill()
    }
  } else if (type === 'rocky_peaks') {
    // Tier 4: Jagged rocky mountains with snow caps at the rear
    const peaks = [
      { gx: -0.35, gz: -0.5, w: R * 0.35, h: R * 0.32 },
      { gx: 0.05, gz: -0.55, w: R * 0.3, h: R * 0.28 },
    ]

    for (const p of peaks) {
      const base = proj(p.gx, p.gz)
      const top = { x: base.x, y: base.y - p.h }
      const left = { x: base.x - p.w / 2, y: base.y }
      const right = { x: base.x + p.w / 2, y: base.y }

      // Sunlit left face
      ctx.beginPath()
      ctx.moveTo(top.x, top.y)
      ctx.lineTo(left.x, left.y)
      ctx.lineTo(base.x, base.y)
      ctx.closePath()
      ctx.fillStyle = '#64748b'
      ctx.fill()

      // Shadowed right face
      ctx.beginPath()
      ctx.moveTo(top.x, top.y)
      ctx.lineTo(base.x, base.y)
      ctx.lineTo(right.x, right.y)
      ctx.closePath()
      ctx.fillStyle = '#334155'
      ctx.fill()

      // Crisp white snow cap
      const capH = p.h * 0.28
      const capY = top.y + capH
      ctx.beginPath()
      ctx.moveTo(top.x, top.y)
      ctx.lineTo(top.x - (p.w / 4) * 0.35, capY)
      ctx.lineTo(top.x, capY + 2)
      ctx.lineTo(top.x + (p.w / 4) * 0.35, capY)
      ctx.closePath()
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
    }
  } else if (type === 'cliffs_waterfall') {
    // Tier 5: Towering cliffs
    const cliffBase = proj(-0.25, -0.48)
    const cliffW = Math.max(36, R * 0.42)
    const cliffH = Math.max(30, R * 0.38)

    // Sheer cliff face with rock strata
    ctx.beginPath()
    ctx.moveTo(cliffBase.x - cliffW / 2, cliffBase.y)
    ctx.lineTo(cliffBase.x - cliffW / 2, cliffBase.y - cliffH)
    ctx.lineTo(cliffBase.x + cliffW / 2, cliffBase.y - cliffH)
    ctx.lineTo(cliffBase.x + cliffW / 2, cliffBase.y)
    ctx.closePath()

    const cliffGrad = ctx.createLinearGradient(cliffBase.x, cliffBase.y - cliffH, cliffBase.x, cliffBase.y)
    cliffGrad.addColorStop(0, '#64748b')
    cliffGrad.addColorStop(0.5, '#475569')
    cliffGrad.addColorStop(1, '#334155')
    ctx.fillStyle = cliffGrad
    ctx.fill()

    // Horizontal rock ridges
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)'
    ctx.lineWidth = 1.5
    for (let s = 1; s <= 3; s++) {
      const yL = cliffBase.y - (cliffH * s) / 4
      ctx.beginPath()
      ctx.moveTo(cliffBase.x - cliffW / 2 + 4, yL)
      ctx.lineTo(cliffBase.x + cliffW / 2 - 4, yL + 2)
      ctx.stroke()
    }
  }

  ctx.restore()
}

/**
 * ── 3. Day 1 Bare Substrate (Tier 0) ────────────────────────────────────────
 */
export function drawSubstrateBed(ctx, { cx, cy, R, sinPitch, yaw, screenCorners }) {
  ctx.save()

  // Fertile dark soil top face
  ctx.beginPath()
  ctx.moveTo(screenCorners[0].x, screenCorners[0].y)
  for (let i = 1; i < screenCorners.length; i++) {
    ctx.lineTo(screenCorners[i].x, screenCorners[i].y)
  }
  ctx.closePath()

  const soilGrad = ctx.createLinearGradient(cx, cy - R * sinPitch, cx, cy + R * sinPitch)
  soilGrad.addColorStop(0, '#593b22')
  soilGrad.addColorStop(0.5, '#442b17')
  soilGrad.addColorStop(1, '#2f1c0d')
  ctx.fillStyle = soilGrad
  ctx.fill()

  // Tilled furrow ridges
  ctx.strokeStyle = 'rgba(25, 12, 4, 0.5)'
  ctx.lineWidth = 1.5
  for (let f = -3; f <= 3; f++) {
    const ox = f * (R * 0.15)
    ctx.beginPath()
    ctx.moveTo(cx + ox - R * 0.35, cy + (ox * 0.3) * sinPitch)
    ctx.lineTo(cx + ox + R * 0.35, cy + (ox * 0.3 + 15) * sinPitch)
    ctx.stroke()
  }

  // Tiny sprouting green sapling shoots in center
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const sprouts = [
    { x: 0, z: 0 },
    { x: -0.15, z: 0.1 },
    { x: 0.18, z: -0.12 },
  ]

  for (const s of sprouts) {
    const p = projectGround(s.x, s.z, { cx, cy, R, sinPitch, cosYaw, sinYaw })
    // Tiny twin leaves
    ctx.beginPath()
    ctx.ellipse(p.x - 3, p.y - 4, 3, 1.5, -0.4, 0, Math.PI * 2)
    ctx.ellipse(p.x + 3, p.y - 4, 3, 1.5, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#4ade80'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y - 4)
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * ── 4. Ethereal Climax Rainbow Arc (Tier 5) ──────────────────────────────────
 */
export function drawRainbow(ctx, { cx, cy, R, sinPitch }) {
  ctx.save()

  const bowRx = R * 1.3
  const bowRy = R * sinPitch * 1.5
  const bowCy = cy - R * 0.25

  const colors = [
    'rgba(239, 68, 68, 0.22)',  // Red
    'rgba(249, 115, 22, 0.22)', // Orange
    'rgba(234, 179, 8, 0.22)',  // Yellow
    'rgba(34, 197, 94, 0.22)',  // Green
    'rgba(59, 130, 246, 0.22)', // Blue
    'rgba(168, 85, 247, 0.22)', // Violet
  ]

  ctx.lineWidth = Math.max(2, R * 0.02)
  for (let i = 0; i < colors.length; i++) {
    ctx.beginPath()
    ctx.ellipse(cx, bowCy, bowRx - i * 3, bowRy - i * 1.5, 0, Math.PI * 1.05, Math.PI * 1.95)
    ctx.strokeStyle = colors[i]
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * ── 5. Weather Particle Simulation ───────────────────────────────────────────
 */
export function initWeatherParticles(count = 30, type = 'rain') {
  const particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.15 + Math.random() * 0.25,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      type,
    })
  }
  return particles
}

export function updateWeatherParticles(particles, dt, type = 'rain') {
  for (const p of particles) {
    if (type === 'rain') {
      p.x += 0.08 * dt
      p.y += (0.6 + p.size * 0.15) * dt
    } else if (type === 'snow') {
      p.phase += dt * 2
      p.x += Math.sin(p.phase) * 0.05 * dt
      p.y += (0.12 + p.size * 0.04) * dt
    } else if (type === 'petals') {
      p.phase += dt * 2.5
      p.x += (Math.cos(p.phase) * 0.08 + 0.04) * dt
      p.y += (0.15 + p.size * 0.03) * dt
    } else if (type === 'fireflies') {
      p.phase += dt * 3
      p.x += Math.sin(p.phase * 0.7) * 0.04 * dt
      p.y += Math.cos(p.phase * 0.9) * 0.03 * dt
      p.alpha = 0.25 + Math.sin(p.phase) * 0.5
    } else {
      // dust / leaves
      p.phase += dt * 2
      p.x += (Math.sin(p.phase) * 0.06 + 0.08) * dt
      p.y += 0.18 * dt
    }

    // Wrap around boundaries
    if (p.x < 0) p.x += 1
    if (p.x > 1) p.x -= 1
    if (p.y > 1) {
      p.y = 0
      p.x = Math.random()
    }
  }
}

export function drawWeatherParticles(ctx, particles, width, height, type = 'rain') {
  if (!particles || particles.length === 0) return

  ctx.save()

  for (const p of particles) {
    const px = p.x * width
    const py = p.y * height

    if (type === 'rain') {
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + 3, py + 12 * p.size)
      ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha * 0.7})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    } else if (type === 'snow') {
      ctx.beginPath()
      ctx.arc(px, py, p.size * 0.9, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`
      ctx.fill()
    } else if (type === 'petals') {
      ctx.beginPath()
      ctx.ellipse(px, py, p.size * 1.4, p.size * 0.8, p.phase, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(251, 113, 133, ${p.alpha * 0.85})`
      ctx.fill()
    } else if (type === 'fireflies') {
      const g = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2)
      g.addColorStop(0, `rgba(250, 204, 21, ${Math.max(0, p.alpha)})`)
      g.addColorStop(1, 'rgba(250, 204, 21, 0)')
      ctx.beginPath()
      ctx.arc(px, py, p.size * 2, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    } else {
      // Golden leaves / dust motes
      ctx.beginPath()
      ctx.arc(px, py, p.size * 0.8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(245, 158, 11, ${p.alpha * 0.6})`
      ctx.fill()
    }
  }

  ctx.restore()
}
