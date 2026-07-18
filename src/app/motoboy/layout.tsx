import type { Metadata } from "next"
import MotoboyLayoutClient from "./_MotoboyLayoutClient"

export const metadata: Metadata = {
  manifest: "/manifest-motoboy.json",
  title: "Chegô Motoboy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Motoboy Chegô",
  },
}

export default function MotoboyLayout({ children }: { children: React.ReactNode }) {
  return <MotoboyLayoutClient>{children}</MotoboyLayoutClient>
}
