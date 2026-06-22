import type { Metadata, Viewport } from "next"
import "./globals.css"
import Providers from "./providers"
import PwaRegister from "@/components/PwaRegister"

export const metadata: Metadata = {
  title: "Chegô Delivery",
  description: "Delivery em Aragoiânia - GO",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chegô",
  },
  icons: {
    icon: "/logo-chego.jpg",
    apple: "/logo-chego.jpg",
    shortcut: "/logo-chego.jpg",
  },
}

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo-chego.jpg" />
        <link rel="apple-touch-icon" sizes="1024x1024" href="/logo-chego.jpg" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  )
}
