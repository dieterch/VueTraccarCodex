export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return
  if (!('serviceWorker' in navigator) || !('caches' in window)) return

  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister()
    }
  })

  void caches.keys().then((keys) => {
    for (const key of keys) {
      if (
        key.includes('workbox') ||
        key.includes('google-maps') ||
        key.includes('api-cache')
      ) {
        void caches.delete(key)
      }
    }
  })
})
