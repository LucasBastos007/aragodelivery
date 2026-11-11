import { redirect } from "next/navigation"

// Reembolsos saiu do menu e abre numa gaveta no Início (admin 2.0, 20/10/2026, pedido do Lucas).
export default function ReembolsosPage() { redirect("/chego-ctrl?reembolsos=1") }
