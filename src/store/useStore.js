import { create } from 'zustand'
import { createUiSlice } from './slices/uiSlice'
import { createModeSlice } from './slices/modeSlice'
import { createUserSlice } from './slices/userSlice'
import { createFocusSlice } from './slices/focusSlice'

/**
 * Single Zustand store composed from feature slices. Realtime Firestore
 * listeners (see FirestoreSyncProvider) hydrate this store; components read
 * via fine-grained selectors to avoid re-render storms.
 */
export const useStore = create((...a) => ({
  ...createUiSlice(...a),
  ...createModeSlice(...a),
  ...createUserSlice(...a),
  ...createFocusSlice(...a),
}))
