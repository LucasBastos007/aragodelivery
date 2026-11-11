import { redirect } from "next/navigation"

// O Relatório de vendas foi juntado à tela de Repasses (admin 2.0, 20/10/2026): mesma conta,
// com exportar CSV e salvar PDF. Produtos mais vendidos ficam na Vitrine.
export default function RelatorioPage() { redirect("/chego-ctrl/faturamento") }
