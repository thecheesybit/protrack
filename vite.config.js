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

// The app document's Content-Security-Policy, injected as a <meta> tag at
// BUILD time only (the dev server needs ws://localhost + inline HMR, so dev
// stays unrestricted). This is the only CSP delivery that works everywhere:
// Netlify could send a header, but the packaged desktop app loads over
// file:// where no server — and no webRequest hook — ever sees the document.
// IMPORTANT: this governs OUR document only. Never re-introduce a blanket
// session-wide onHeadersReceived CSP in electron/main.js — stamping the app
// policy onto cross-origin responses is what broke YouTube embeds (their MSE
// streaming XHRs to googlevideo.com died against our connect-src) and risked
// the Google auth popup, in packaged builds only (v1.9.x).
const APP_CSP = [
  "default-src 'self'",
  // unsafe-inline/eval: Vite inline bootstrap + Firebase SDK internals.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.google.com" +
    ' wss://*.firebaseio.com https://*.firebaseio.com' +
    ' https://api.openai.com https://api.anthropic.com' +
    ' https://api.deepseek.com https://api.elevenlabs.io',
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com' +
    ' https://*.firebaseapp.com https://accounts.google.com',
  "media-src 'self' blob: mediastream: https://www.youtube.com" +
    ' https://www.youtube-nocookie.com https://*.googlevideo.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

/** Injects the production CSP <meta> right after <meta charset>. */
function injectCspPlugin() {
  return {
    name: 'protrack-inject-csp',
    transformIndexHtml: {
      handler(html, ctx) {
        if (ctx.server) return html // dev server: no CSP, HMR needs freedom
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${APP_CSP}" />`,
        )
      },
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    injectCspPlugin(),
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
