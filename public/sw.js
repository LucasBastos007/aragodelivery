const CACHE_NAME = "chego-v1"

const PRECACHE = [
  "/",
  "/lojas",
  "/logo-chego.png",
  "/manifest.json",
]

// ─── Instalação ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// ─── Ativação: limpa caches antigos ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch: cache inteligente ─────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET") return
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
        return res
      })
      .catch(() => caches.match(request))
  )
})

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "Chegô Delivery"
  const isMotoboy = (data.tag ?? "").startsWith("motoboy-")

  const options = {
    body:    data.body ?? "",
    icon:    "/logo-chego.png",
    badge:   "/logo-chego.png",
    tag:     data.tag ?? "chego-update",
    data:    { url: data.url ?? (isMotoboy ? "/motoboy" : "/"), sound: isMotoboy },
    vibrate: isMotoboy
      ? [400, 150, 400, 150, 400, 150, 800]
      : [200, 100, 200, 100, 200],
    requireInteraction: data.requireInteraction ?? isMotoboy,
    renotify: isMotoboy,
    silent: false,
    actions: isMotoboy ? [{ action: "open", title: "Ver corrida 🛵" }] : [],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) =>
        list.forEach((c) => c.postMessage({ type: "push-received", tag: data.tag ?? "", isMotoboy }))
      ),
    ])
  )
})

// ─── Clique na notificação ────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
