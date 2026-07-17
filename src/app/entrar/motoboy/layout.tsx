import type { Metadata } from "next"

export const metadata: Metadata = {
  manifest: "/manifest-motoboy.json",
  title: "Chegô Motoboy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Motoboy Chegô",
  },
}

export default function EntrarMotoboyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
