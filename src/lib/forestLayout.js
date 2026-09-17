/**
 * Pure isometric plot layout for the forest terrain.
 *
 * The old forest scattered plants at golden-ratio pseudo-random offsets, which
 * read as messy noise. This lays them out on a real 2.5D isometric grid — the
 * ordered "plot of land" look of the Forest app — deterministically and
 * depth-sorted.
 *
 * Coordinate model (before any pixel scaling):
 *   - A square grid of `g × g` cells, g = ceil(sqrt(n)).
 *   - Cell (col, row) maps to iso space:
 *       isoX = (col - row) * (TILE_W / 2)      → screen horizontal
 *       isoY = (col + row) * (TILE_H / 2)      → screen vertical (depth)
 *   - `depth = col + row` — cells sharing a depth sit on the same on-screen row;
 *     larger depth = nearer the viewer (drawn on top, bigger).
 *
 * Fill strategy (the fix for the "bare plot" look): when n < g², the empty
 * cells are pushed to the **far back tip** of the diamond (lowest depth), which
 * is the smallest, most-occluded corner — it reads as a natural clearing behind
 * the grove. The front and middle always fill first, so the plot never shows a
 * bare foreground or an empty vertex up front. Within a partial depth row, cells
 * fill center-out so the row stays symmetric.
 *
 * The renderer maps the returned normalized `x`/`y` (0..1 across the grass
 * diamond: x 0=left vertex, 1=right vertex; y 0=back vertex, 1=front vertex)
 * onto the terrain, so this module stays DOM/pixel-free and unit-testable.
 */

const TILE_W = 2
const TILE_H = 1

/**
 * @param {number} n number of plants to place (clamped to [0, maxCells])
 * @param {{ maxCells?: number }} [opts]
 * @returns {{
 *   cells: Array<{ index: number, col: number, row: number, depth: number,
 *                  x: number, y: number, scale: number, z: number }>,
 *   grid: number,
 *   placed: number,
 *   overflow: number,
 * }}
 *   `cells` are returned in back-to-front paint order, and `index` is the same
 *   order — so a caller passing items oldest-first plants the eldest at the back
 *   and the newest in front. `scale` grows 0.8 → 1.15 with depth so foreground
 *   plants read larger. `z` = paint order (draw ascending).
 */
export function computeIsoLayout(n, { maxCells = 120 } = {}) {
  const total = Math.max(0, Math.floor(Number(n) || 0))
  const placed = Math.min(total, Math.max(0, Math.floor(maxCells)))
  const overflow = total - placed

  if (placed === 0) {
    return { cells: [], grid: 0, placed: 0, overflow }
  }

  const grid = Math.max(1, Math.ceil(Math.sqrt(placed)))

  if (grid === 1) {
    // A single plant sits at the centre of the plot.
    return {
      cells: [{ index: 0, col: 0, row: 0, depth: 0, x: 0.5, y: 0.5, scale: 1, z: 0 }],
      grid: 1,
      placed: 1,
      overflow,
    }
  }

  const center = (grid - 1) / 2
  const all = []
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      all.push({ col, row, depth: col + row })
    }
  }

  // Selection order: fill the FRONT first (high depth), center-out within a row,
  // so any shortfall lands at the far back tip.
  const chosen = [...all]
    .sort(
      (a, b) =>
        b.depth - a.depth ||
        Math.abs(a.col - center) - Math.abs(b.col - center) ||
        a.col - b.col,
    )
    .slice(0, placed)

  // Paint / assignment order: back-to-front (low depth first), center-out.
  chosen.sort(
    (a, b) =>
      a.depth - b.depth ||
      Math.abs(a.col - center) - Math.abs(b.col - center) ||
      a.col - b.col,
  )

  const maxAbsX = (grid - 1) * (TILE_W / 2)
  const maxY = (grid - 1) * TILE_H // = 2(grid-1)*(TILE_H/2)
  const maxDepth = 2 * (grid - 1)

  const cells = chosen.map((c, index) => {
    const isoX = (c.col - c.row) * (TILE_W / 2)
    const isoY = (c.col + c.row) * (TILE_H / 2)
    const x = (isoX + maxAbsX) / (2 * maxAbsX)
    const y = isoY / maxY
    const scale = 0.8 + (c.depth / maxDepth) * 0.35
    return {
      index,
      col: c.col,
      row: c.row,
      depth: c.depth,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      scale: Number(scale.toFixed(3)),
      z: c.depth,
    }
  })

  return { cells, grid, placed, overflow }
}

/**
 * Calculates the dynamic grid dimension needed to comfortably house `n` trees.
 * Scales dynamically up to 100x100+ for 10,000+ trees.
 */
export function getGridDimension(n) {
  const total = Math.max(0, Math.floor(Number(n) || 0))
  if (total === 0) return 0
  if (total === 1) return 1
  return Math.max(2, Math.ceil(Math.sqrt(total)))
}

/**
 * 360° Rotatable Isometric Layout Engine.
 *
 * Given `n` items, an arbitrary yaw angle (0..2π), and pitch angle (default ~30°),
 * returns all tree positions in 3D ground coordinates and projected screen coordinates,
 * sorted strictly by rotated camera depth (back-to-front) for flawless 360° depth sorting.
 *
 * @param {number} n Total items
 * @param {{ yaw?: number, pitch?: number, maxCells?: number }} [opts]
 */
export function computeRotatedIsoLayout(n, { yaw = 0, pitch = 0.5236, maxCells = 10000 } = {}) {
  const total = Math.max(0, Math.floor(Number(n) || 0))
  const placed = Math.min(total, Math.max(0, Math.floor(maxCells)))
  const overflow = total - placed

  if (placed === 0) {
    return { cells: [], grid: 0, placed: 0, overflow }
  }

  const grid = getGridDimension(placed)

  if (grid === 1) {
    return {
      cells: [
        {
          index: 0,
          col: 0,
          row: 0,
          x0: 0,
          z0: 0,
          rx: 0,
          rz: 0,
          sx: 0,
          sy: 0,
          depth: 0,
          scale: 1,
          z: 0,
        },
      ],
      grid: 1,
      placed: 1,
      overflow,
    }
  }

  const center = (grid - 1) / 2
  const maxR = Math.max(0.5, center)
  const sinPitch = Math.sin(pitch)
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)

  // Place items on the grid
  const rawCells = []
  for (let idx = 0; idx < placed; idx++) {
    const row = Math.floor(idx / grid)
    const col = idx % grid
    // Normalized 3D ground coordinates with guaranteed edge clearance (> 1 row/col)
    // maxFloraRatio = 0.70 guarantees the outer 30% remains an open meadow/cliff buffer
    const maxFloraRatio = 0.70
    const x0 = ((col - center) / maxR) * maxFloraRatio
    const z0 = ((row - center) / maxR) * maxFloraRatio

    // Rotate around Y-axis by yaw
    const rx = x0 * cosYaw - z0 * sinYaw
    const rz = x0 * sinYaw + z0 * cosYaw

    // Project onto 2D screen plane
    const sx = rx
    const sy = rz * sinPitch
    const depth = rz
    const scale = 0.82 + ((rz + 1.414) / 2.828) * 0.36

    rawCells.push({
      index: idx,
      col,
      row,
      x0: Number(x0.toFixed(4)),
      z0: Number(z0.toFixed(4)),
      rx: Number(rx.toFixed(4)),
      rz: Number(rz.toFixed(4)),
      sx: Number(sx.toFixed(4)),
      sy: Number(sy.toFixed(4)),
      depth: Number(depth.toFixed(4)),
      scale: Number(scale.toFixed(3)),
    })
  }

  // Sort strictly back-to-front (lowest depth first)
  rawCells.sort((a, b) => a.depth - b.depth)

  const cells = rawCells.map((c, zIdx) => ({
    ...c,
    z: zIdx,
  }))

  return { cells, grid, placed, overflow }
}

/**
 * Computes which of the 4 extruded soil faces are visible from the camera
 * at an arbitrary yaw angle, along with their sunlit directional shading factors.
 *
 * Ground corners in local space [-1, 1]:
 * 0: (-1, -1) Top-Left
 * 1: ( 1, -1) Top-Right
 * 2: ( 1,  1) Bottom-Right
 * 3: (-1,  1) Bottom-Left
 *
 * Edge i connects corner i to (i+1)%4.
 */
export function computeVisibleSoilFaces(yaw) {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)

  // 4 corners of ground square
  const corners = [
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: 1, z: 1 },
    { x: -1, z: 1 },
  ].map((pt) => ({
    rx: pt.x * cosYaw - pt.z * sinYaw,
    rz: pt.x * sinYaw + pt.z * cosYaw,
  }))

  // Outward normals of the 4 edges
  // Edge 0: (0, -1)
  // Edge 1: (1, 0)
  // Edge 2: (0, 1)
  // Edge 3: (-1, 0)
  const rawNormals = [
    { x: 0, z: -1, name: 'north' },
    { x: 1, z: 0, name: 'east' },
    { x: 0, z: 1, name: 'south' },
    { x: -1, z: 0, name: 'west' },
  ]

  // Fixed light vector (sun shining from top-right-front)
  const sun = { x: 0.55, z: 0.83 } // normalized approx

  const faces = rawNormals.map((norm, i) => {
    const rx = norm.x * cosYaw - norm.z * sinYaw
    const rz = norm.x * sinYaw + norm.z * cosYaw

    // Camera looks along +Z axis towards origin:
    // A face is visible if its rotated normal points toward the camera (rz > 0)
    const isVisible = rz > 0.001

    // Shading factor based on dot product with sun
    const dotSun = Math.max(0.2, (rx * sun.x + rz * sun.z + 1) / 2)

    return {
      index: i,
      name: norm.name,
      startIndex: i,
      endIndex: (i + 1) % 4,
      isVisible,
      normalZ: rz,
      lightFactor: Number(dotSun.toFixed(3)),
    }
  })

  // Visible faces sorted by depth (furthest back first, so foreground soil renders on top)
  const visibleFaces = faces
    .filter((f) => f.isVisible)
    .sort((a, b) => a.normalZ - b.normalZ)

  return { corners, faces, visibleFaces }
}

/**
 * Returns indices of trees surrounding a given target tree within a specified
 * grid distance radius. Used for the X-ray tree peeking effect on hover.
 */
export function getSurroundingTreeIndices(cells = [], targetIndex, maxDistance = 1.8) {
  if (targetIndex === null || targetIndex === undefined) return []
  const target = cells.find((c) => c.index === targetIndex)
  if (!target) return []

  const maxDistSq = maxDistance * maxDistance
  const neighbors = []

  for (const c of cells) {
    if (c.index === targetIndex) continue
    const dCol = c.col - target.col
    const dRow = c.row - target.row
    const distSq = dCol * dCol + dRow * dRow
    if (distSq <= maxDistSq) {
      neighbors.push(c.index)
    }
  }

  return neighbors
}

/**
 * Generates the 6 vertices of a regular hexagonal prism in 3D ground space
 * rotated around the vertical Y-axis by yaw.
 */
export function computeHexCorners(yaw = 0) {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const corners = []

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 6
    const x0 = Math.cos(angle)
    const z0 = Math.sin(angle)

    const rx = x0 * cosYaw - z0 * sinYaw
    const rz = x0 * sinYaw + z0 * cosYaw

    corners.push({
      id: i,
      x0: Number(x0.toFixed(4)),
      z0: Number(z0.toFixed(4)),
      rx: Number(rx.toFixed(4)),
      rz: Number(rz.toFixed(4)),
    })
  }

  return corners
}

/**
 * Computes visible camera-facing extruded soil faces for a 6-sided hexagonal prism diorama.
 * Correctly sorted by camera depth with sunlit directional shading.
 */
export function computeHexVisibleSoilFaces(yaw = 0) {
  const corners = computeHexCorners(yaw)
  const sunX = -0.707
  const sunZ = -0.707
  const visibleFaces = []

  for (let i = 0; i < 6; i++) {
    const nextIdx = (i + 1) % 6
    const c0 = corners[i]
    const c1 = corners[nextIdx]

    // Screen horizontal vector in clockwise winding:
    // When projected, if c1.rx > c0.rx, the face normal has a positive camera depth (+Z)
    const dx = c1.rx - c0.rx
    if (dx > 0.001) {
      const ex = c1.x0 - c0.x0
      const ez = c1.z0 - c0.z0
      const len = Math.hypot(ex, ez) || 1
      const nx = ez / len
      const nz = -ex / len

      const dot = nx * sunX + nz * sunZ
      const lightFactor = Math.max(0.18, Math.min(1.0, 0.58 + dot * 0.42))

      visibleFaces.push({
        startIndex: i,
        endIndex: nextIdx,
        lightFactor: Number(lightFactor.toFixed(3)),
        depth: (c0.rz + c1.rz) / 2,
      })
    }
  }

  // Sort back-to-front
  visibleFaces.sort((a, b) => a.depth - b.depth)

  return { corners, visibleFaces }
}
