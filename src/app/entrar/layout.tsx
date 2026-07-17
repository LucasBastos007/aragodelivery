import type { Metadata } from "next"

export const metadata: Metadata = {
  manifest: "/manifest-loja.json",
  title: "Chegô Lojista",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lojista Chegô",
  },
}

export default function EntrarLojaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
