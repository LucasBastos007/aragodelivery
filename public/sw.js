self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "Arago Delivery"
  const options = {
    body:    data.body ?? "",
    icon:    "/next.svg",
    badge:   "/next.svg",
    tag:     data.tag ?? "arago-update",
    data:    data.url ? { url: data.url } : {},
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url
  if (url) {
    event.waitUntil(clients.openWindow(url))
  }
})
