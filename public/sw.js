// sw.js — bump CACHE_NAME a cada deploy para forçar atualização
const CACHE_NAME = "chego-v4"

// Só arquivos verdadeiramente estáticos (têm hash no nome → nunca mudam)
const PRECACHE = [
  "/logo-chego.png",
  "/manifest.json",
]

// ─── Instalação ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  // Assume controle imediatamente, sem esperar aba fechar
  self.skipWaiting()
})

// ─── Ativação: apaga TODOS os caches antigos ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar não-GET e requisições de outros domínios
  if (request.method !== "GET") return
  if (url.origin !== self.location.origin &&
      !url.hostname.endsWith("supabase.co")) return

  // APIs e Supabase: sempre rede, sem cache
  if (url.pathname.startsWith("/api/") ||
      url.hostname.includes("supabase")) {
    event.respondWith(fetch(request))
    return
  }

  // Assets estáticos do Next.js com hash no nome → cache permanente
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }

  // Imagens e ícones públicos → cache com fallback de rede
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|gif)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }

  // Páginas HTML (/, /lojas, /checkout etc.) → SEMPRE rede primeiro
  // Nunca cachear HTML: o conteúdo muda a cada deploy
  event.respondWith(
    fetch(request).catch(() => {
      // Só cai no cache se estiver offline
      return caches.match(request) ??
        new Response("<h1>Sem conexão</h1><p>Verifique sua internet e tente novamente.</p>",
          { headers: { "Content-Type": "text/html" } })
    })
  )
})

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "Chegô Delivery"
  const tag = data.tag ?? "chego-update"
  const isMotoboy = tag.startsWith("motoboy-")
  const isEntregue = title.includes("entregue") || title.includes("Entregue")

  const options = {
    body:    data.body ?? "",
    icon:    "/logo-chego.png",
    badge:   "/logo-chego.png",
    tag,
    data:    { url: data.url ?? (isMotoboy ? "/motoboy" : "/") },
    vibrate: isMotoboy
      ? [400, 150, 400, 150, 400, 150, 800]
      : isEntregue
        ? [300, 100, 300, 100, 300, 100, 600, 200, 600]
        : [200, 100, 200, 100, 200],
    requireInteraction: data.requireInteraction ?? isMotoboy ?? isEntregue,
    renotify: true,
    silent: false,
    actions: isMotoboy
      ? [{ action: "open", title: "Ver corrida 🛵" }]
      : isEntregue
        ? [{ action: "open", title: "Avaliar pedido ⭐" }]
        : [],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) =>
        list.forEach((c) => c.postMessage({ type: "push-received", tag, isMotoboy, isEntregue }))
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
