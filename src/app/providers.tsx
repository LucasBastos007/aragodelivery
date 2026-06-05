"use client"
import { CartProvider } from "@/lib/cart"
import { AuthProvider } from "@/lib/auth"
export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>
}
