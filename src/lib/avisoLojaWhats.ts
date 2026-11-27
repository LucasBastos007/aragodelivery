// Aviso de pedido novo no WhatsApp do lojista (pedido do Lucas, 27/11/2026).
// Vai pelo Z-API sempre que um pedido chega na loja (status "pendente"), uma vez por pedido.
//
// Liga/desliga e modo de teste ficam em configuracoes.chave = "aviso_loja_whats" (JSON):
//   { "ativo": true, "teste_para": "62998712690" }  -> todos os avisos vão só para esse número
//   { "ativo": true }                                -> cada loja recebe no próprio telefone
//   { "ativo": true, "lojas_off": ["<loja_id>"] }    -> lojas que não querem receber
// Sem a chave (ou ativo=false) não envia nada.
//
// Segurança: tudo é lido do banco pelo pedido_id (nada vem de quem chamou). Não manda nome,
// endereço nem telefone do cliente, só o código, quantidade de itens, valor dos produtos e pagamento.
import { enviarTexto, zapiOk } from "@/lib/whatsSuporte"
import { rotuloPagamento } from "@/lib/pagamentoDividido"

type Cfg = { ativo?: boolean; teste_para?: string | null; lojas_off?: string[] }

const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

function numeroWhats(t?: string | null): string | null {
  const d = (t ?? "").replace(/\D/g, "")
  if (d.length < 10) return null
  return d.length <= 11 ? `55${d}` : d
}

export async function avisarLojaWhats(sb: any, pedidoId: string): Promise<string> {
  if (!pedidoId || !zapiOk()) return "sem-zapi"

  const { data: c } = await sb.from("configuracoes").select("valor").eq("chave", "aviso_loja_whats").maybeSingle()
  let cfg: Cfg = {}
  try { cfg = JSON.parse(c?.valor ?? "{}") } catch { /* vazio */ }
  if (!cfg.ativo) return "desligado"

  const { data: p } = await sb.from("pedidos")
    .select("id, codigo, status, loja_id, subtotal, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, itens:itens_pedido(quantidade)")
    .eq("id", pedidoId).maybeSingle()
  if (!p || p.status !== "pendente") return "nao-pendente"
  if ((cfg.lojas_off ?? []).includes(p.loja_id)) return "loja-off"

  const { data: loja } = await sb.from("lojas").select("nome, telefone").eq("id", p.loja_id).maybeSingle()
  const destino = numeroWhats(cfg.teste_para || loja?.telefone)
  if (!destino) return "sem-telefone"

  // Uma vez por pedido: a tabela webhook_events tem chave única (provider, external_event_id)
  const { error: dup } = await sb.from("webhook_events").insert({ provider: "aviso-loja-whats", external_event_id: p.id, payload: { codigo: p.codigo } })
  if (dup) return dup.code === "23505" ? "ja-avisado" : "erro-registro"

  const qtd = (p.itens ?? []).reduce((s: number, i: any) => s + (Number(i.quantidade) || 0), 0)
  const pagoOnline = ["pix", "cartao"].includes(p.forma_pagamento) && !p.forma_pagamento_2
  const linhas = [
    `🔔 *Pedido novo no Chegô!*`,
    ``,
    `Pedido *#${p.codigo}*${cfg.teste_para && loja?.nome ? ` (${loja.nome})` : ""}`,
    `${qtd} ${qtd === 1 ? "item" : "itens"}, ${brl(p.subtotal)} em produtos`,
    `Pagamento: ${rotuloPagamento(p)}${pagoOnline ? " (já pago)" : ""}`,
    ``,
    `Abra o painel para aceitar: ${SITE()}/loja`,
  ]
  try {
    await enviarTexto(destino, linhas.join("\n"))
    return "enviado"
  } catch (e) {
    console.error("[AVISO LOJA WHATS] falhou", p.codigo, e)
    return "erro-envio"
  }
}
