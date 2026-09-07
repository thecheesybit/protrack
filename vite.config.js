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
  // https://apis.google.com: Firebase's popup-based Google Sign-In
  // (browserPopupRedirectResolver) dynamically injects <script src=
  // ".../js/api.js"> into the OPENER window (our own app) to load gapi's
  // iframe/messaging bridge that coordinates the popup handshake — without
  // this host allowed, the load is CSP-blocked and Firebase surfaces the
  // generic `auth/internal-error` with no indication it was a CSP issue.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.google.com" +
    ' wss://*.firebaseio.com https://*.firebaseio.com' +
    ' https://api.openai.com https://api.anthropic.com' +
    ' https://api.deepseek.com https://api.elevenlabs.io',
  // apis.google.com also needs frame-src: gapi's cross-window relay opens its
  // own postMessage iframe from that origin, separate from the OAuth popup
  // window itself (which Chromium doesn't gate through frame-src at all).
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com' +
    ' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com',
  "media-src 'self' blob: mediastream: https://www.youtube.com" +
    ' https://www.youtube-nocookie.com https://*.googlevideo.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

/**
 * Injects the production CSP <meta> right after <meta charset>.
 *
 * ELECTRON BUILD ONLY. The desktop document loads locally (from the internal
 * http://localhost server) where no server can send a CSP header, so a build-
 * time meta tag is the only way to give it a policy. The WEB build (Netlify)
 * must NOT get this meta: it's the public landing + the `/link` device-linking
 * page, whose Google sign-in popup loads apis.google.com and other Google
 * origins into the opener — a restrictive app meta CSP there silently blocked
 * the popup and surfaced as `auth/internal-error` ("Couldn't link"). Netlify
 * can carry its own security headers via netlify.toml if desired.
 */
function injectCspPlugin() {
  return {
    name: 'protrack-inject-csp',
    transformIndexHtml: {
      handler(html, ctx) {
        if (ctx.server) return html // dev server: no CSP, HMR needs freedom
        if (!withElectron) return html // web build: no restrictive meta CSP
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
            main: {
              entry: 'electron/main.js',
              onstart(args) {
                const devUserData = path.join(
                  process.env.APPDATA ||
                    (process.platform === 'darwin'
                      ? path.join(process.env.HOME || '', 'Library/Application Support')
                      : path.join(process.env.HOME || '', '.config')),
                  'pro-track-dev',
                )
                args.startup(['.', '--no-sandbox', `--user-data-dir=${devUserData}`])
              },
            },
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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react'
            }
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'vendor-firebase'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts'
            }
            if (id.includes('chrono-node')) {
              return 'vendor-nlp'
            }
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('@google/generative-ai') || id.includes('openai') || id.includes('@anthropic-ai')) {
              return 'vendor-ai'
            }
          }
        },
      },
    },
  },
})
