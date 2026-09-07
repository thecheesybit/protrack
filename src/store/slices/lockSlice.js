import { getLockConfig } from '@/services/lockService'

/**
 * Zustand slice for Application Lock state.
 * Initializes with isLocked = true if a valid lock configuration exists in storage,
 * preventing any flash of workspace content before authentication.
 */
export const createLockSlice = (set, get) => {
  const initialConfig = getLockConfig()
  return {
    isLocked: Boolean(initialConfig?.enabled),
    lockConfig: initialConfig,

    lockApp: () => {
      const config = get().lockConfig || getLockConfig()
      if (config?.enabled) {
        set({ isLocked: true, lockConfig: config })
      }
    },

    unlockApp: () => {
      set({ isLocked: false })
    },

    setLockConfigState: (lockConfig) => {
      set((state) => ({
        lockConfig,
        isLocked: lockConfig?.enabled ? state.isLocked : false,
      }))
    },

    refreshLockConfig: () => {
      const config = getLockConfig()
      set((state) => ({
        lockConfig: config,
        isLocked: config?.enabled ? state.isLocked : false,
      }))
    },
  }
}
