import { redirect } from "next/navigation"

// A tela de Saques foi juntada a Pagamentos (admin 2.0, 20/10/2026). Comissão e mensalidade de cada
// loja (a antiga aba "Planos das lojas") ficam em Taxas e frete.
export default function SaquesPage() { redirect("/chego-ctrl/repasses") }
