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

/**
 * Full 25-minute "tree unit" is the target grain for the forest. A completed
 * session is only ever "unsimplified" (legacy) when its recorded `durationMin`
 * exceeds a single tree block — after {@link computePlantings} splits it, every
 * resulting doc has `durationMin <= 25`, so this predicate is naturally
 * idempotent and drives the one-time forest-simplifier migration.
 *
 * @param {{ durationMin?: number, completed?: boolean, failedReason?: string }} session
 * @returns {boolean}
 */
export function needsSimplify(session) {
  if (!session) return false
  if (session.completed === false || session.failedReason) return false
  return (Number(session.durationMin) || 0) > 25
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

/**
 * Resolves the plant type for a single session according to the standard scale:
 * - flower < 10m
 * - shrub 10-15m
 * - tree > 15m
 * Honors an explicit `plantType` field if valid.
 */
export function getPlantTypeForDuration(plantType, durationMin) {
  if (plantType && ['flower', 'shrub', 'tree'].includes(plantType)) {
    return plantType
  }
  const dur = Number(durationMin) || 25
  if (dur < 10) return 'flower'
  if (dur <= 15) return 'shrub'
  return 'tree'
}

/**
 * Pure transform for the one-time forest-simplifier migration (Goal B).
 *
 * Given an array of focus session documents, finds all completed sessions whose
 * duration exceeds 25 minutes, expands each into child session payloads using
 * {@link computePlantings}, and preserves all parent metadata (modeId, subjectId,
 * slotId, targetDate, label, title, color, hourOfDay, startedAt, createdAt).
 *
 * Also recalculates the complete post-migration { treesGrown, shrubsGrown, flowersGrown }
 * totals across all valid sessions.
 *
 * @param {Array<object>} sessions
 * @returns {{
 *   toCreate: Array<{ docData: object, originalId: string }>,
 *   toDelete: Array<string>,
 *   convertedCount: number,
 *   createdCount: number,
 *   deletedCount: number,
 *   newStats: { treesGrown: number, shrubsGrown: number, flowersGrown: number }
 * }}
 */
export function planSessionSimplification(sessions = []) {
  const toCreate = []
  const toDelete = []
  let convertedCount = 0
  const postMigrationFlora = []

  for (const s of sessions || []) {
    if (!s) continue
    // Failed or incomplete sessions don't produce flora
    if (s.completed === false || s.failedReason) continue

    if (needsSimplify(s)) {
      convertedCount++
      if (s.id) toDelete.push(s.id)
      const plantings = computePlantings(Number(s.durationMin) || 0)
      for (const p of plantings) {
        const docData = {
          modeId: s.modeId ?? null,
          subjectId: s.subjectId ?? null,
          slotId: s.slotId ?? null,
          targetDate: s.targetDate ?? null,
          label: s.label ?? null,
          title: s.title ?? s.label ?? null,
          color: s.color ?? null,
          durationMin: p.durationMin,
          plantType: p.type,
          completed: true,
          hourOfDay: s.hourOfDay ?? null,
          startedAt: s.startedAt ?? null,
          createdAt: s.createdAt ?? null,
        }
        toCreate.push({ docData, originalId: s.id })
        postMigrationFlora.push(p.type)
      }
    } else {
      // Retained unchanged session
      const dur = Number(s.durationMin) || 0
      if (dur > 0) {
        const type = getPlantTypeForDuration(s.plantType, dur)
        postMigrationFlora.push(type)
      }
    }
  }

  const newStats = {
    treesGrown: 0,
    shrubsGrown: 0,
    flowersGrown: 0,
  }
  for (const type of postMigrationFlora) {
    if (type === 'tree') newStats.treesGrown++
    else if (type === 'shrub') newStats.shrubsGrown++
    else if (type === 'flower') newStats.flowersGrown++
  }

  return {
    toCreate,
    toDelete,
    convertedCount,
    createdCount: toCreate.length,
    deletedCount: toDelete.length,
    newStats,
  }
}

