self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "Chego Delivery"
  const options = {
    body:    data.body ?? "",
    icon:    "/logo-chego.png",
    badge:   "/logo-chego.png",
    tag:     data.tag ?? "chego-update",
    data:    data.url ? { url: data.url } : {},
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.requireInteraction ?? false,
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Encaminha para abas abertas para disparar beep em segundo plano
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(list =>
        list.forEach(c => c.postMessage({ type: "push-received", tag: data.tag ?? "" }))
      ),
    ])
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url
  if (url) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
    )
  }
})
