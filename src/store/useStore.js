import { create } from 'zustand'
import { createUiSlice } from './slices/uiSlice'
import { createModeSlice } from './slices/modeSlice'

/**
 * Single Zustand store composed from feature slices. Realtime Firestore
 * listeners (see FirestoreSyncProvider) hydrate this store; components read
 * via fine-grained selectors to avoid re-render storms.
 */
export const useStore = create((...a) => ({
  ...createUiSlice(...a),
  ...createModeSlice(...a),
}))
