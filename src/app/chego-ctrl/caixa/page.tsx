import { redirect } from "next/navigation"

// Caixa dos motoboys virou uma aba de Movimentos (admin 2.0, 20/10/2026).
export default function CaixaPage() { redirect("/chego-ctrl/movimentos?aba=caixa") }
