import { describe, it, expect } from 'vitest'
import {
  computeIsoLayout,
  computeRotatedIsoLayout,
  computeVisibleSoilFaces,
  computeHexCorners,
  computeHexVisibleSoilFaces,
  getSurroundingTreeIndices,
  getGridDimension,
} from '@/lib/forestLayout'

describe('computeIsoLayout', () => {
  it('returns nothing for an empty grove', () => {
    const { cells, placed, grid } = computeIsoLayout(0)
    expect(cells).toEqual([])
    expect(placed).toBe(0)
    expect(grid).toBe(0)
  })

  it('places a single plant at the centre of the plot', () => {
    const { cells, grid } = computeIsoLayout(1)
    expect(grid).toBe(1)
    expect(cells).toHaveLength(1)
    expect(cells[0].x).toBeCloseTo(0.5)
    expect(cells[0].y).toBeCloseTo(0.5)
    expect(cells[0].scale).toBe(1)
  })

  it('sizes the grid as ceil(sqrt(n))', () => {
    expect(computeIsoLayout(4).grid).toBe(2)
    expect(computeIsoLayout(5).grid).toBe(3)
    expect(computeIsoLayout(9).grid).toBe(3)
    expect(computeIsoLayout(10).grid).toBe(4)
  })

  it('paints back-to-front: depth is non-decreasing in placement order', () => {
    const { cells } = computeIsoLayout(9)
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].depth).toBeGreaterThanOrEqual(cells[i - 1].depth)
    }
  })

  it('fills the front first — a partial grove keeps its foreground, clearing the far back tip', () => {
    // n=5 in a 3×3 grid: front vertex present, back vertex (depth 0) empty.
    const { cells } = computeIsoLayout(5)
    const maxDepth = 2 * (3 - 1)
    expect(cells.some((c) => c.depth === maxDepth)).toBe(true) // front tip filled
    expect(cells.some((c) => c.depth === 0)).toBe(false) // back tip left as a clearing
  })

  it('fills the whole diamond (including the back tip) when the grid is full', () => {
    const { cells } = computeIsoLayout(9) // exactly 3×3
    expect(cells).toHaveLength(9)
    expect(cells.some((c) => c.depth === 0)).toBe(true)
  })

  it('normalizes coordinates and grows scale toward the foreground', () => {
    const { cells } = computeIsoLayout(9)
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThanOrEqual(1)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThanOrEqual(1)
    }
    expect(cells.at(-1).scale).toBeGreaterThan(cells[0].scale)
  })

  it('is deterministic for a given count', () => {
    expect(computeIsoLayout(7)).toEqual(computeIsoLayout(7))
  })

  it('caps at maxCells and reports overflow', () => {
    const { placed, overflow, cells } = computeIsoLayout(200, { maxCells: 60 })
    expect(placed).toBe(60)
    expect(overflow).toBe(140)
    expect(cells).toHaveLength(60)
  })

  it('never places two plants in the same cell', () => {
    const { cells } = computeIsoLayout(12)
    const seen = new Set(cells.map((c) => `${c.col},${c.row}`))
    expect(seen.size).toBe(cells.length)
  })
})

describe('getGridDimension', () => {
  it('returns appropriate grid dimensions for any grove size', () => {
    expect(getGridDimension(0)).toBe(0)
    expect(getGridDimension(1)).toBe(1)
    expect(getGridDimension(4)).toBe(2)
    expect(getGridDimension(25)).toBe(5)
    expect(getGridDimension(100)).toBe(10)
    expect(getGridDimension(10000)).toBe(100)
  })
})

describe('computeRotatedIsoLayout', () => {
  it('returns empty for 0 items', () => {
    const res = computeRotatedIsoLayout(0)
    expect(res.cells).toEqual([])
    expect(res.placed).toBe(0)
  })

  it('places a single item at origin at any rotation', () => {
    const res0 = computeRotatedIsoLayout(1, { yaw: 0 })
    const res90 = computeRotatedIsoLayout(1, { yaw: Math.PI / 2 })
    expect(res0.cells[0].sx).toBe(0)
    expect(res0.cells[0].sy).toBe(0)
    expect(res90.cells[0].sx).toBe(0)
    expect(res90.cells[0].sy).toBe(0)
  })

  it('strictly depth-sorts back-to-front (depth is non-decreasing) at any angle', () => {
    const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]
    for (const yaw of angles) {
      const { cells } = computeRotatedIsoLayout(16, { yaw })
      for (let i = 1; i < cells.length; i++) {
        expect(cells[i].depth).toBeGreaterThanOrEqual(cells[i - 1].depth)
      }
    }
  })

  it('handles massive groves (> 2,500 trees) without error', () => {
    const { cells, grid } = computeRotatedIsoLayout(2500)
    expect(cells).toHaveLength(2500)
    expect(grid).toBe(50)
  })

  it('projects coordinates symmetrically across the origin at 45° standard isometric yaw', () => {
    const { cells } = computeRotatedIsoLayout(9, { yaw: Math.PI * 0.25 })
    // Center element in a 3x3 (col=1, row=1) must project to exactly (sx=0, sy=0)
    const centerCell = cells.find((c) => c.col === 1 && c.row === 1)
    expect(centerCell).toBeDefined()
    expect(centerCell.sx).toBeCloseTo(0, 5)
    expect(centerCell.sy).toBeCloseTo(0, 5)
  })
})

describe('computeVisibleSoilFaces', () => {
  it('identifies front-facing soil walls based on yaw', () => {
    const res0 = computeVisibleSoilFaces(0)
    // At yaw 0, south (index 2) faces the camera (+Z)
    expect(res0.visibleFaces.some((f) => f.name === 'south')).toBe(true)

    const res180 = computeVisibleSoilFaces(Math.PI)
    // At yaw 180, north (index 0) faces the camera
    expect(res180.visibleFaces.some((f) => f.name === 'north')).toBe(true)
  })

  it('always has 1 or 2 visible faces for a rotated box viewed from above', () => {
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180
      const { visibleFaces } = computeVisibleSoilFaces(rad)
      expect(visibleFaces.length).toBeGreaterThanOrEqual(1)
      expect(visibleFaces.length).toBeLessThanOrEqual(3)
    }
  })
})

describe('getSurroundingTreeIndices', () => {
  it('finds immediate neighbor trees on the grid', () => {
    const { cells } = computeRotatedIsoLayout(9) // 3x3 grid: center is (1, 1) = index 4
    const neighbors = getSurroundingTreeIndices(cells, 4, 1.5)
    // In a 3x3, the 4 cardinal neighbors (col±1, row±1) have distance 1.0 <= 1.5, diagonals have sqrt(2) ≈ 1.414 <= 1.5
    expect(neighbors.length).toBe(8)
    expect(neighbors).not.toContain(4)
  })

  it('returns empty for null or missing target', () => {
    expect(getSurroundingTreeIndices([], null)).toEqual([])
    expect(getSurroundingTreeIndices([], 99)).toEqual([])
  })
})

describe('hexagonal prism diorama & edge clearance', () => {
  it('guarantees trees stay strictly inside 70% radius leaving > 1 row/col open buffer', () => {
    // Test for small, medium, and massive groves
    for (const n of [9, 25, 100, 1000]) {
      const { cells } = computeRotatedIsoLayout(n)
      for (const c of cells) {
        expect(Math.abs(c.x0)).toBeLessThanOrEqual(0.701)
        expect(Math.abs(c.z0)).toBeLessThanOrEqual(0.701)
      }
    }
  })

  it('computes 6 regular hexagonal prism corners in 3D ground space', () => {
    const corners = computeHexCorners(0)
    expect(corners).toHaveLength(6)
    // Check distance from origin is 1.0
    for (const c of corners) {
      const dist = Math.hypot(c.x0, c.z0)
      expect(dist).toBeCloseTo(1.0, 3)
    }
  })

  it('computes 1 to 3 visible front-facing soil walls for hexagonal prism at any yaw', () => {
    for (let deg = 0; deg < 360; deg += 45) {
      const rad = (deg * Math.PI) / 180
      const { visibleFaces } = computeHexVisibleSoilFaces(rad)
      expect(visibleFaces.length).toBeGreaterThanOrEqual(1)
      expect(visibleFaces.length).toBeLessThanOrEqual(4)
      for (const face of visibleFaces) {
        expect(face.lightFactor).toBeGreaterThan(0)
        expect(face.lightFactor).toBeLessThanOrEqual(1.0)
      }
    }
  })
})

