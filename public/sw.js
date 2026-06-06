const CACHE_NAME = 'protrack-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/zen_quotes.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return
  
  // Exclude Firebase, Netlify Functions, etc.
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/.netlify') || url.host.includes('firebase')) return

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Stale-while-revalidate strategy for the app shell
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone())
        })
        return networkResponse
      }).catch(() => response) // If network fails, just return cache

      return response || fetchPromise
    })
  )
})
