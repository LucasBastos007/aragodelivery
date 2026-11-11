import type { Metadata, Viewport } from "next"
import "./globals.css"
import "./chego-novo.css"
import { Bricolage_Grotesque, Figtree } from "next/font/google"
import Providers from "./providers"
import PwaRegister from "@/components/PwaRegister"
import OnlinePing from "@/components/OnlinePing"

// Fontes do layout novo (19/10/2026): títulos em Bricolage Grotesque, texto em Figtree.
const fonteDisplay = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" })
const fonteCorpo = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-corpo", display: "swap" })

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
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/logo-chego.png",
    shortcut: "/icon-192.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#D7261E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteDisplay.variable} ${fonteCorpo.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo-chego.png" />
        <link rel="apple-touch-icon" sizes="1024x1024" href="/logo-chego.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
        <OnlinePing />
      </body>
    </html>
  )
}
