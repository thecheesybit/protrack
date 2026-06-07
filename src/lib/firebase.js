import { initializeApp } from 'firebase/app'
import {
  initializeAuth,
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Trim every env value — CI secrets pasted via the GitHub UI commonly carry a
// trailing newline that turns "my-project" into "my-project\n", which makes
// Firebase build URLs like "my-project%0A.firebaseapp.com" and silently hangs
// every auth request. Belt-and-braces guard so the build never breaks on a
// whitespace artifact again.
const clean = (v) => (typeof v === 'string' ? v.trim() : v)
const firebaseConfig = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
}

/** True only when the essential config is present, so the app can boot a
 *  friendly setup notice instead of crashing on a missing config. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

if (import.meta.env.DEV) {
  console.info('[firebase] config presence', {
    apiKey: Boolean(firebaseConfig.apiKey),
    authDomain: Boolean(firebaseConfig.authDomain),
    projectId: firebaseConfig.projectId || '(missing)',
    appId: Boolean(firebaseConfig.appId),
  })
}

let app = null
let auth = null
let db = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  // Persistence priority list — Firebase tries each in order and falls back.
  // We explicitly include browserLocalPersistence FIRST because the default
  // IndexedDB persistence can hang on Electron's `file://` protocol (Chromium
  // scopes IDB per file path, which Firebase Auth's init read doesn't tolerate
  // well). localStorage works reliably under file://; IDB is the fallback for
  // browsers where localStorage is constrained; in-memory is the last resort.
  try {
    auth = initializeAuth(app, {
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        inMemoryPersistence,
      ],
      // CRITICAL: without an explicit popupRedirectResolver, signInWithPopup
      // throws `auth/argument-error` because the popup machinery isn't wired
      // up. getAuth() includes this by default; initializeAuth() does not.
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch (err) {
    // initializeAuth throws if called twice — fall back to getAuth.
    console.warn('[firebase] initializeAuth fell back to getAuth', err)
    auth = getAuth(app)
  }
  // Offline-first: a persistent IndexedDB cache serves reads locally (≈0 server
  // reads on reload), queues writes offline, and survives across tabs. This is
  // the backbone of both free-tier compliance and offline resiliency.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('[firebase] persistent cache unavailable, using default', err)
    db = getFirestore(app)
  }
}

// GoogleAuthProvider is a plain config object — safe to build unconditionally.
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export { app, auth, db }
