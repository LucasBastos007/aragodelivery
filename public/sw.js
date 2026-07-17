// sw.js — bump CACHE_NAME a cada deploy para forçar atualização
const CACHE_NAME = "chego-v6"

// ─── Background Location ──────────────────────────────────────────────────────
// Armazena última posição recebida da aba principal para envio em background
let bgLocation = null

self.addEventListener("message", (event) => {
  if (event.data?.type === "store-location") {
    bgLocation = { lat: event.data.lat, lng: event.data.lng }
  }
})

// Background Sync: quando o browser resgata a aba do background, envia a posição armazenada
self.addEventListener("sync", (event) => {
  if (event.tag === "bg-location") {
    event.waitUntil(
      (async () => {
        if (!bgLocation) return
        await fetch("/api/motoboy/update-location", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bgLocation),
        }).catch(() => {})
      })()
    )
  }
})

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
  const isMotoboy = tag.startsWith("motoboy-") || tag.startsWith("avulsa-")
  const isEntregue = title.includes("entregue") || title.includes("Entregue")
  const isCheguei  = tag.startsWith("cheguei-")

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
    data: {
      url:       data.url ?? (isMotoboy ? "/motoboy" : "/"),
      pedido_id: data.pedido_id ?? null,
      motoboy_id: data.motoboy_id ?? null,
    },
    actions: isMotoboy
      ? [
          { action: "aceitar", title: "✅ Aceitar corrida" },
          { action: "open",    title: "🛵 Ver detalhes"   },
        ]
      : isEntregue
        ? [{ action: "open", title: "Avaliar pedido ⭐" }]
        : [],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) =>
        list.forEach((c) => c.postMessage({ type: "push-received", tag, isMotoboy, isEntregue, isCheguei }))
      ),
    ])
  )
})

// ─── Clique na notificação ────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const notifData = event.notification.data ?? {}
  const action    = event.action

  // Aceite direto da notificação (sem abrir app)
  if (action === "aceitar" && notifData.pedido_id && notifData.motoboy_id) {
    event.waitUntil(
      fetch("/api/motoboy/aceitar-corrida", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ pedido_id: notifData.pedido_id }),
      }).then(() => {
        // Abre o app após aceitar para acompanhar a entrega
        return clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
          for (const c of list) {
            if (c.url.includes("/motoboy") && "focus" in c) return c.focus()
          }
          if (clients.openWindow) return clients.openWindow("/motoboy")
        })
      }).catch(() => {
        // Fallback: abre o app
        return clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
          if (clients.openWindow) return clients.openWindow("/motoboy")
        })
      })
    )
    return
  }

  // Ação "open" ou clique normal → abre o app
  const url = notifData.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
