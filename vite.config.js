import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Single source of truth for the app version: package.json. Baked in at build
// time as __APP_VERSION__ so the renderer (web AND desktop) can always show the
// real version without a hardcoded literal drifting out of sync.
const pkgVersion = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
).version

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
            preload: {
              input: path.join(process.cwd(), 'electron/preload.js'),
              vite: {
                build: {
                  rollupOptions: {
                    output: {
                      entryFileNames: '[name].cjs',
                    },
                  },
                },
              },
            },
          }),
        ]
      : []),
  ],
  // Compile-time flag so the renderer knows this is an Electron build even
  // before the preload bridge has injected window.protrack. Prevents the
  // marketing LandingPage from ever flashing inside the desktop app.
  define: {
    __IS_ELECTRON__: JSON.stringify(withElectron),
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  server: {
    port: 5173,
    // Don't pop a browser tab during desktop dev — the Electron window is the app.
    open: !withElectron,
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
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-nlp': ['chrono-node'],
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
