import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

// Build the Electron layer only when explicitly targeting desktop, so the
// normal `vite build` for Netlify stays a pure web build.
const withElectron = process.env.ELECTRON === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(withElectron
      ? [
          electron({
            main: { entry: 'electron/main.js' },
            preload: { input: path.join(process.cwd(), 'electron/preload.js') },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy vendors so the app shell loads fast and caches well.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-dnd': [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
          ],
        },
      },
    },
  },
})
