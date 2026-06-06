import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createMode } from '@/services/modeService'
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
  const byName = new Map(existingModes.map((m) => [m.name, m]))
  let activeModeId = null
  let order = existingModes.length

  for (const preset of selectedPresets) {
    const existing = byName.get(preset.name)
    if (existing) {
      if (!activeModeId) activeModeId = existing.id
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

  await setDoc(
    doc(db, 'users', uid),
    {
      settings: {
        ...(activeModeId ? { activeModeId } : {}),
        onboarding: {
          version: LEGAL_VERSION,
          acceptedLegalAt: serverTimestamp(),
          completedAt: serverTimestamp(),
        },
      },
    },
    { merge: true },
  )
}
