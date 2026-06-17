self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "Chego Delivery"
  const isMotoboy = (data.tag ?? "").startsWith("motoboy-")

  const options = {
    body:    data.body ?? "",
    icon:    "/logo-chego.png",
    badge:   "/logo-chego.png",
    tag:     data.tag ?? "chego-update",
    data:    { url: data.url ?? (isMotoboy ? "/motoboy" : "/"), sound: isMotoboy },
    // Vibração longa e repetida para nova corrida, curta para demais
    vibrate: isMotoboy
      ? [400, 150, 400, 150, 400, 150, 800]
      : [200, 100, 200, 100, 200],
    requireInteraction: data.requireInteraction ?? isMotoboy,
    renotify: isMotoboy,
    silent: false,
    actions: isMotoboy
      ? [{ action: "open", title: "Ver corrida 🛵" }]
      : [],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Avisa abas/janelas abertas para tocar som
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(list =>
        list.forEach(c => c.postMessage({
          type:      "push-received",
          tag:       data.tag ?? "",
          isMotoboy,
        }))
      ),
    ])
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/motoboy"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
