import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createMode, deleteMode } from '@/services/modeService'
import { LEGAL_VERSION } from '@/content/legal'

/**
 * Finalise first-run onboarding:
 *  1. Create any selected preset scopes the user doesn't already have (deduped
 *     by name — the first login seeds UPSC + M.Tech, so re-selecting them is a
 *     no-op rather than a duplicate).
 *  2. Point activeModeId at the first selected scope.
 *  3. Stamp legal acceptance + completion onto the user doc.
 *
 * @param {string} uid
 * @param {{ selectedPresets: Array<{name:string,icon:string,accentColor:string}>,
 *           existingModes: Array<{id:string,name:string}> }} input
 */
export async function completeOnboarding(uid, { selectedPresets, existingModes }) {
  const selectedPresetNames = new Set(selectedPresets.map((p) => p.name))
  const byName = new Map(existingModes.map((m) => [m.name, m]))
  let activeModeId = null
  let order = existingModes.length

  // Delete existing modes that were NOT selected in onboarding
  for (const mode of existingModes) {
    if (!selectedPresetNames.has(mode.name)) {
      await deleteMode(uid, mode.id)
    }
  }

  for (const preset of selectedPresets) {
    const existing = byName.get(preset.name)
    if (existing) {
      if (selectedPresetNames.has(preset.name)) {
        if (!activeModeId) activeModeId = existing.id
      }
      continue
    }
    const ref = await createMode(uid, {
      name: preset.name,
      icon: preset.icon,
      accentColor: preset.accentColor,
      order: order++,
    })
    if (!activeModeId) activeModeId = ref.id
  }

  // Use client timestamps (Date.now), NOT serverTimestamp(): a serverTimestamp
  // reads back as `null` on the optimistic local snapshot, so the Workspace gate
  // (which flips to the dashboard on `settings.onboarding.completedAt`) would
  // hang on "Setting up…" until the server round-trip confirms — and stalls
  // outright if that write is slow or queued. A client timestamp is truthy the
  // instant the write applies locally, so onboarding completes immediately.
  await setDoc(
    doc(db, 'users', uid),
    {
      settings: {
        activeModeId: activeModeId || 'all',
        onboarding: {
          version: LEGAL_VERSION,
          acceptedLegalAt: Date.now(),
          completedAt: Date.now(),
        },
      },
    },
    { merge: true },
  )
}
