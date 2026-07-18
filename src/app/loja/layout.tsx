import type { Metadata } from "next"
import LojaLayoutClient from "./_LojaLayoutClient"

export const metadata: Metadata = {
  manifest: "/manifest-loja.json",
  title: "Chegô Lojista",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chegô Lojista",
  },
}

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return <LojaLayoutClient>{children}</LojaLayoutClient>
}
