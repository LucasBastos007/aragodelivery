import { redirect } from "next/navigation"

// O Relatório do lojista calculava o líquido com regra antiga (só 10% de comissão) e dava valor
// diferente do Financeiro. Juntado ao Financeiro (20/10/2026), que usa a conta validada.
export default function RelatorioLojaPage() { redirect("/loja/financeiro") }
