import { redirect } from "next/navigation"

// A entrada do lojista agora é a tela nova /loja/entrar (21/10/2026). Links e atalhos antigos
// pra /entrar continuam funcionando e caem nela. O login do motoboy (/entrar/motoboy) não muda.
export default function EntrarPage() { redirect("/loja/entrar") }
