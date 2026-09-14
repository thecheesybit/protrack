/**
 * Pure plant-growth math for completed Deep Focus sessions.
 *
 * Sessions under 25 minutes keep the original single-plant scale unchanged
 * (flower <10m, shrub 10-15m, tree >15m) — no regression for short sessions.
 * Sessions of 25+ minutes plant one tree per full 25-minute block; any
 * leftover time is capped at shrub/flower (never promoted to another tree —
 * "a tree every 25 minutes, and the rest as shrubs or flowers").
 */

/** @param {number} durationMin @returns {'flower'|'shrub'|'tree'} */
function shortSessionPlantType(durationMin) {
  if (durationMin < 10) return 'flower'
  if (durationMin <= 15) return 'shrub'
  return 'tree'
}

/**
 * @param {number} durationMin total focused minutes for the completed session
 * @returns {Array<{ type: 'flower'|'shrub'|'tree', durationMin: number }>}
 *   Always at least one entry.
 */
export function computePlantings(durationMin) {
  const total = Math.max(1, Math.round(durationMin) || 0)

  if (total < 25) {
    return [{ type: shortSessionPlantType(total), durationMin: total }]
  }

  const treeCount = Math.floor(total / 25)
  const remainder = total - treeCount * 25

  const plantings = Array.from({ length: treeCount }, () => ({ type: 'tree', durationMin: 25 }))
  if (remainder > 0) {
    plantings.push({ type: remainder < 10 ? 'flower' : 'shrub', durationMin: remainder })
  }
  return plantings
}

/** Tallies a plantings array into `{ trees, shrubs, flowers }` counts. */
export function summarizePlantings(plantings) {
  const counts = { trees: 0, shrubs: 0, flowers: 0 }
  for (const p of plantings || []) {
    if (p.type === 'tree') counts.trees += 1
    else if (p.type === 'shrub') counts.shrubs += 1
    else if (p.type === 'flower') counts.flowers += 1
  }
  return counts
}
