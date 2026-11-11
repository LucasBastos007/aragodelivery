// Apresentação do fechamento financeiro diário: HTML (→ PDF), planilha Excel e corpo do
// e-mail. Só formata o que `calcularFechamento` devolveu — nenhum cálculo financeiro aqui.

import ExcelJS from "exceljs"
import type { Alerta, Fechamento } from "@/lib/fechamentoFinanceiro"

const R = (v: number) => (v < -0.004 ? "−" : "") + "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const hora = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—"
export const dataBr = (ymd: string) => { const [a, m, d] = ymd.split("-"); return `${d}/${m}/${a}` }
const FORMA: Record<string, string> = { pix: "Pix (Asaas)", cartao: "Cartão online (Asaas)", maquininha: "Maquininha", dinheiro: "Dinheiro", pix_loja: "Pix pago à loja", outras: "Outras" }
const RECEB: Record<string, string> = { asaas: "Asaas", maquininha_app: "Maquininha Chegô", motoboy_dinheiro: "Motoboy (dinheiro)", loja: "Loja" }
const TIPO_MOV: Record<string, string> = {
  retirada_dinheiro: "Retirada em dinheiro", adiantamento: "Adiantamento", bonus: "Bônus / adicional", desconto: "Desconto",
  pagamento: "Pagamento", repasse: "Repasse à loja", entrega_caixa: "Dinheiro entregue ao caixa",
  pagamento_autorizado_dinheiro: "Pagamento autorizado (dinheiro)", conferencia_caixa: "Conferência de caixa",
  ajuste_credito: "Ajuste (crédito)", ajuste_debito: "Ajuste (débito)", transferencia_interna: "Transferência interna", nao_identificado: "Pix sem identificação",
}

const CSS = `*{box-sizing:border-box}body{font:11px/1.45 Arial,Helvetica,sans-serif;color:#16181d;margin:0}main{padding:22px 26px}
h1{font-size:19px;margin:0}h2{font-size:14px;margin:20px 0 8px;padding-top:9px;border-top:2px solid #e4e4e0;page-break-after:avoid}h3{font-size:12px;margin:12px 0 6px}
.sub{color:#6b7280;margin:2px 0 12px;font-size:10.5px}.brand{color:#F26522;font-weight:800;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:9px;margin-bottom:6px;table-layout:auto}th,td{padding:3px 6px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
th{background:#1a1a1a;color:#fff;font-size:8.5px;white-space:normal}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tr.t td{font-weight:800;border-top:2px solid #1a1a1a;background:#fff3ec}
tr{page-break-inside:avoid}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.c{border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px}
.c .l{font-size:9px;color:#6b7280;text-transform:uppercase}.c .v{font-size:15px;font-weight:800}.c.hl{border-color:#F26522;background:#fff7ed}
.kv td:first-child{width:62%}.al{border-radius:8px;padding:7px 10px;margin:5px 0;font-size:10px}.al.critico{background:#fef2f2;border:1px solid #fca5a5}
.al.atencao{background:#fffbeb;border:1px solid #fcd34d}.al.info{background:#f3f4f6;border:1px solid #e5e7eb}.note{color:#6b7280;font-size:9.5px}
.tag{font-size:8.5px;color:#6b7280}.pos{color:#166534}.neg{color:#b91c1c}.selo{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#fef3c7;color:#92400e}`

function alertaHtml(a: Alerta) {
  return `<div class="al ${a.nivel}"><b>${esc(a.titulo)}</b>${a.valor !== undefined ? ` — ${R(a.valor)}` : ""}<br>${esc(a.detalhe)}${a.pedido ? ` · Pedido <b>${esc(a.pedido)}</b>` : ""}${a.responsavel ? ` · ${esc(a.responsavel)}` : ""}</div>`
}

export function htmlFechamento(f: Fechamento): string {
  const s = f.resumo, r = f.receita
  const kv = (rows: [string, string][]) => `<table class="kv">${rows.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join("")}</table>`
  const lojas = f.lojas.map(l => `<tr><td>${esc(l.nome)}</td><td class="n">${l.pedidos}</td><td class="n">${R(l.produtos)}</td><td class="n">${l.descontos ? R(l.descontos) : "—"}</td><td class="n">${R(l.comissao)}<br><span class="tag">${esc(l.comissaoPct)}</span></td><td class="n">${l.participacaoEntrega ? R(l.participacaoEntrega) : "—"}</td><td class="n">${R(l.taxaPagamento)}</td><td class="n">${l.recebidoPelaLoja ? R(l.recebidoPelaLoja) : "—"}</td><td class="n">${l.outrosAjustes ? R(l.outrosAjustes) : "—"}</td><td class="n"><b>${R(l.liquido)}</b></td><td class="n">${l.repassadoDia ? R(l.repassadoDia) : "—"}</td><td class="n"><b>${R(l.pendenteAtual)}</b></td></tr>`).join("")
  const sumL = (k: keyof Fechamento["lojas"][number]) => f.lojas.reduce((a, l) => a + (l[k] as number), 0)
  const mbs = f.motoboys.map(m => `<tr><td>${esc(m.nome)}</td><td class="n">${m.entregas}</td><td class="n">${m.entregasAvulsas ? `${m.entregasAvulsas} (${R(m.ganhoAvulsas)})` : "—"}</td><td class="n">${m.entregasPix}/${m.entregasDinheiro}/${m.entregasCartao}</td><td class="n">${R(m.dinheiroRecebido)}</td><td class="n">${m.outrasModalidades ? R(m.outrasModalidades) : "—"}</td><td class="n">${R(m.ganho)}</td><td class="n">${m.bonus ? R(m.bonus) : "—"}</td><td class="n">${m.descontos + m.retiradasDinheiro ? R(m.descontos + m.retiradasDinheiro) : "—"}</td><td class="n">${m.pagamentosRecebidos ? R(m.pagamentosRecebidos) : "—"}</td><td class="n"><b>${R(m.saldoReceber)}</b></td><td class="n">${R(m.dinheiroSobResponsabilidade)}</td><td class="n ${m.saldoFinal < 0 ? "neg" : "pos"}"><b>${R(m.saldoFinal)}</b></td></tr>`).join("")
  const mbDet = f.motoboys.map(m => `<h3>${esc(m.nome)}</h3>${kv([
    ["Entregas concluídas (Pix / dinheiro / cartão)", `${m.entregas} (${m.entregasPix} / ${m.entregasDinheiro} / ${m.entregasCartao})`],
    ["Das quais entregas avulsas (AV)", m.entregasAvulsas ? `${m.entregasAvulsas} — ${R(m.ganhoAvulsas)}` : "—"],
    ["Dinheiro recebido dos clientes no dia", R(m.dinheiroRecebido)],
    ["Recebido na maquininha da Chegô (vai para a Stone, não fica com ele)", R(m.outrasModalidades)],
    ["Taxas de entrega que lhe pertencem", `${R(m.ganho)}${m.complementoPiso ? ` <span class="tag">(inclui ${R(m.complementoPiso)} de complemento até o mínimo de R$ 4,00)</span>` : ""}`],
    ["(+) Bônus e adicionais", m.bonus ? `${R(m.bonus)} <span class="tag">${esc(m.bonusDescricao.join("; "))}</span>` : "—"],
    ["(−) Descontos e ajustes", m.descontos ? R(m.descontos) : "—"],
    ["(−) Retiradas em dinheiro (ficou com o dinheiro como pagamento)", m.retiradasDinheiro ? R(m.retiradasDinheiro) : "—"],
    ["(−) Adiantamentos recebidos no dia", m.pagamentosRecebidos ? R(m.pagamentosRecebidos) : "—"],
    ["<b>Total a receber do dia</b>", `<b>${R(m.saldoReceber)}</b>`],
    ["Ajuda de custo semanal (paga à parte — não entra no valor do dia)", m.ajudaCustoInfo ? R(m.ajudaCustoInfo) : "—"],
    ["Pagamentos enviados no dia (referentes a períodos anteriores — informativo)", m.pagamentosInfo ? R(m.pagamentosInfo) : "—"],
    ["(−) Entregue ao caixa / usado em pagamento autorizado no dia", R(m.dinheiroEntregueCaixa + m.dinheiroPagamentosAutorizados)],
    ["<b>Dinheiro físico a prestar contas à Chegô</b>", `<b>${R(m.dinheiroSobResponsabilidade)}</b>`],
    ["Conferido", m.conferido === null ? "sem conferência registrada" : `${R(m.conferido)} <span class="tag">(${esc(m.conferidoOrigem)})</span>`],
    [`<b>Saldo final</b> <span class="tag">(a receber − dinheiro em mãos)</span>`, `<b class="${m.saldoFinal < 0 ? "neg" : "pos"}">${m.saldoFinal < 0 ? `entregar à Chegô ${R(-m.saldoFinal)}` : `receber ${R(m.saldoFinal)}`}</b>`],
  ])}`).join("")
  const movs = f.movimentosDia.map(m => `<tr><td>${hora(m.ocorrido_em)}</td><td>${esc(m.nome)}</td><td>${TIPO_MOV[m.tipo] ?? m.tipo}</td><td>${esc(m.forma ?? "—")}</td><td class="n">${R(m.valor)}</td><td>${esc(m.responsavel ?? "—")}</td><td>${esc(m.motivo)}</td></tr>`).join("")
  const pedidos = f.pedidos.map(p => `<tr><td><b>${esc(p.codigo)}</b><br><span class="tag">${hora(p.criado_em)}</span></td><td>${esc(p.loja)}</td><td>${esc(p.motoboy ?? (p.isRetirada ? "retirada" : "—"))}</td><td>${FORMA[p.forma] ?? esc(p.forma)}<br><span class="tag">${RECEB[p.recebidoPor]}</span></td><td class="n">${R(p.produtos)}</td><td class="n">${R(p.entrega)}</td><td class="n">${p.desconto ? R(p.desconto) : "—"}</td><td class="n">${R(p.totalCliente)}</td><td class="n">${p.comissao ? R(p.comissao) : "—"}<br><span class="tag">${p.comissaoPct}%${p.isAvulsa ? " AV" : ""}</span></td><td class="n">${p.taxaPagamento ? R(p.taxaPagamento) : "—"}</td><td class="n">${p.participacaoEntrega ? R(p.participacaoEntrega) : "—"}</td><td class="n"><b>${R(p.liquidoLoja)}</b></td><td class="n">${p.ganhoMotoboy ? R(p.ganhoMotoboy) : "—"}</td><td class="n">${p.asaasTaxa !== null ? R(p.asaasTaxa) : "—"}</td></tr>`).join("")
  const crit = f.alertas.filter(a => a.nivel !== "info")

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento ${dataBr(f.data)}</title><style>${CSS}</style></head><body><main>
<div class="brand">CHEGÔ Delivery · CNPJ 67.543.510/0001-86</div>
<h1>Fechamento Financeiro Diário — ${dataBr(f.data)}</h1>
<p class="sub">Movimentos de 00:00 a 23:59:59 (Brasília) · gerado em ${hora(f.corteEm)} · última atualização considerada: ${hora(f.ultimoMovimentoEm)} · somente movimentos do dia${s.resultadoParcial ? ` · <span class="selo">RESULTADO PARCIAL</span>` : ""}</p>

${crit.length ? `<h2>Alertas</h2>${crit.map(alertaHtml).join("")}` : `<div class="al info"><b>Sem divergências financeiras.</b></div>`}

<h2>1. Resumo geral do dia</h2>
<div class="grid"><div class="c"><div class="l">Pedidos realizados</div><div class="v">${s.pedidosRealizados}</div></div><div class="c"><div class="l">Concluídos / cancelados</div><div class="v">${s.concluidos} / ${s.cancelados}</div></div><div class="c"><div class="l">Faturamento bruto</div><div class="v">${R(s.faturamentoBruto)}</div></div><div class="c hl"><div class="l">Resultado ${s.resultadoParcial ? "parcial" : "apurado"} da Chegô</div><div class="v">${R(s.resultado)}</div></div></div>
${kv([
  ["Pedidos em andamento no corte / aguardando pagamento", `${s.emAndamento} / ${s.aguardandoPagamento}`],
  ["Faturamento bruto (pago pelos clientes nos pedidos concluídos)", R(s.faturamentoBruto)],
  ["Produtos vendidos", R(s.produtos)],
  ["Taxas de entrega", R(s.taxasEntrega)],
  ["Descontos e cupons", `${R(s.descontos)} <span class="tag">loja ${R(s.descontosLoja)} · Chegô ${R(s.descontosChego)}${s.descontosNaoIdentificados ? ` · não identificado ${R(s.descontosNaoIdentificados)}` : ""}</span>`],
  ["Comissões geradas para a Chegô", R(s.comissoes)],
  ["Total devido aos estabelecimentos (vendas do dia)", R(s.devidoLojas)],
  ["Total devido aos motoboys (entregas do dia)", R(s.devidoMotoboys)],
  ["Receita bruta do aplicativo", R(s.receitaBruta)],
  ["Despesas e custos identificados", R(s.custos)],
  [`<b>Resultado líquido ${s.resultadoParcial ? "PARCIAL" : "apurado"}</b>`, `<b>${R(s.resultado)}</b>`],
])}
<p class="note">Faturamento bruto não é receita: a maior parte pertence às lojas (produtos) e aos motoboys (entregas).</p>
<h3>Por modalidade de pagamento</h3>
<table><tr><th>Modalidade</th><th class="n">Pedidos</th><th class="n">Valor</th><th>Quem recebeu</th></tr>${f.porForma.map(x => `<tr><td>${FORMA[x.forma] ?? x.forma}</td><td class="n">${x.pedidos}</td><td class="n">${R(x.valor)}</td><td>${esc(x.recebidoPor)}</td></tr>`).join("")}<tr class="t"><td>Total</td><td class="n">${f.porForma.reduce((a, x) => a + x.pedidos, 0)}</td><td class="n">${R(f.porForma.reduce((a, x) => a + x.valor, 0))}</td><td></td></tr></table>

<h2>2. Resultado financeiro por loja</h2>
<table><tr><th>Loja</th><th class="n">Ped.</th><th class="n">Produtos</th><th class="n">Desc.</th><th class="n">Comissão</th><th class="n">R$1 entr.</th><th class="n">Taxa pgto</th><th class="n">Recebido pela loja</th><th class="n">Ajustes</th><th class="n">Líquido dia</th><th class="n">Pix enviado no dia*</th><th class="n">A repassar (do dia)</th></tr>${lojas}
<tr class="t"><td>Total</td><td class="n">${sumL("pedidos")}</td><td class="n">${R(sumL("produtos"))}</td><td class="n">${R(sumL("descontos"))}</td><td class="n">${R(sumL("comissao"))}</td><td class="n">${R(sumL("participacaoEntrega"))}</td><td class="n">${R(sumL("taxaPagamento"))}</td><td class="n">${R(sumL("recebidoPelaLoja"))}</td><td class="n">${R(sumL("outrosAjustes"))}</td><td class="n">${R(sumL("liquido"))}</td><td class="n">${R(sumL("repassadoDia"))}</td><td class="n">${R(sumL("pendenteAtual"))}</td></tr></table>
<p class="note">Comissão sobre os produtos conforme o contrato da loja (Petiscaria Tábua dos Sabores isenta — plano Black). Avulsas (AV): sem comissão até 11/10/2026 e 10% desde 12/10/2026. "R$ 1 entrega": parte da entrega assumida pela loja (Armazém Gastrobar e Petiscaria), cobrada separada da comissão. "Já recebido pela loja": Pix pago à loja e retiradas pagas no balcão (maquininha ou dinheiro). Valor negativo = a loja deve à Chegô. *Pix enviado à loja no dia (normalmente o repasse semanal de dias anteriores) — informativo, não abate o valor do dia.</p>

<h2>3. Fechamento individual dos motoboys</h2>
<table><tr><th>Motoboy</th><th class="n">Entregas</th><th class="n">Avulsas</th><th class="n">Pix/Din/Cartão</th><th class="n">Dinheiro recebido</th><th class="n">Maquininha</th><th class="n">Taxas dele</th><th class="n">Bônus</th><th class="n">Descontos/retiradas</th><th class="n">Adiant.</th><th class="n">A receber do dia</th><th class="n">Dinheiro a prestar contas</th><th class="n">Saldo final</th></tr>${mbs}</table>
<p class="note">O dinheiro recebido dos clientes não é a remuneração do motoboy. O saldo final só abate o dinheiro em mãos do valor a receber depois de considerar os pagamentos, retiradas e entregas ao caixa registrados. Negativo = o motoboy deve entregar à Chegô.</p>
${mbDet}

<h2>4. Controle de dinheiro físico</h2>
${kv([
  ["Pedidos pagos em dinheiro no dia", `${f.pedidos.filter(p => p.forma === "dinheiro").length} (${R(f.pedidos.filter(p => p.forma === "dinheiro").reduce((a, p) => a + p.totalCliente, 0))})`],
  ["Recebidos pelos motoboys em entregas", R(f.motoboys.reduce((a, m) => a + m.dinheiroRecebido, 0))],
  ["Recebidos pelas lojas no balcão (retirada)", R(f.pedidos.filter(p => p.forma === "dinheiro" && p.recebidoPor === "loja").reduce((a, p) => a + p.totalCliente, 0))],
  ["Usado em pagamentos autorizados", R(f.motoboys.reduce((a, m) => a + m.dinheiroPagamentosAutorizados, 0))],
  ["Retiradas / adiantamentos em dinheiro", R(f.motoboys.reduce((a, m) => a + m.retiradasDinheiro, 0))],
  ["Entregue ao caixa / responsável financeiro", R(f.motoboys.reduce((a, m) => a + m.dinheiroEntregueCaixa, 0))],
  ["<b>Ainda sob responsabilidade dos motoboys</b>", `<b>${R(f.motoboys.reduce((a, m) => a + m.dinheiroSobResponsabilidade, 0))}</b>`],
])}
<table><tr><th>Motoboy</th><th class="n">Recebido no dia</th><th class="n">Retiradas</th><th class="n">Entregue ao caixa</th><th class="n">Pag. autorizados</th><th class="n">Esperado em mãos</th><th class="n">Conferido</th><th class="n">Diferença</th></tr>
${f.motoboys.map(m => `<tr><td>${esc(m.nome)}</td><td class="n">${R(m.dinheiroRecebido)}</td><td class="n">${R(m.retiradasDinheiro)}</td><td class="n">${R(m.dinheiroEntregueCaixa)}</td><td class="n">${R(m.dinheiroPagamentosAutorizados)}</td><td class="n"><b>${R(m.dinheiroSobResponsabilidade)}</b></td><td class="n">${m.conferido === null ? "—" : R(m.conferido)}</td><td class="n ${m.divergenciaCaixa ? "neg" : ""}">${m.divergenciaCaixa === null ? "sem conferência" : R(m.divergenciaCaixa)}</td></tr>`).join("")}</table>
<h3>Movimentações do dia</h3>
${movs ? `<table><tr><th>Data/hora</th><th>Quem</th><th>Tipo</th><th>Forma</th><th class="n">Valor</th><th>Responsável</th><th>Motivo</th></tr>${movs}</table>` : `<p class="note">Nenhuma movimentação registrada no dia (retiradas, adiantamentos, entregas ao caixa, Pix enviados).</p>`}

<h2>5. Receita e resultado da Chegô</h2>
${kv([
  ["Receita de comissões", R(r.comissoes)],
  ["Receita das cobranças de R$ 1,00 por entrega", R(r.participacaoEntrega)],
  ["Taxas de pagamento cobradas das lojas", R(r.taxasPagamentoCobradas)],
  [`Mensalidades recebidas no dia${r.mensalidadesDetalhe.length ? ` <span class="tag">(${esc(r.mensalidadesDetalhe.map(m => `${m.loja} ${R(m.valor)}`).join("; "))})</span>` : ""}`, R(r.mensalidades)],
  ["Outras receitas", R(r.outrasReceitas)],
  ["<b>Receita total</b>", `<b>${R(r.receitaTotal)}</b>`],
  ["(−) Taxas de processamento (reais, Asaas)", R(r.taxasProcessamento)],
  ["(−) Cupons e descontos custeados pela Chegô", R(r.cuponsChego)],
  ["(−) Complemento até o mínimo de R$ 4,00 por entrega", R(r.complementoPiso)],
  ["(−) Bônus e incentivos aos motoboys", R(r.bonus)],
  ["(−) Pagamentos autorizados em dinheiro", R(r.pagamentosAutorizados)],
  [`(−) Despesas cadastradas${r.despesasDetalhe.length ? ` <span class="tag">(${esc(r.despesasDetalhe.map(d => `${d.descricao} ${R(d.valor)}`).join("; "))})</span>` : ""}`, R(r.despesas)],
  ["<b>Custos totais</b>", `<b>${R(r.custosTotal)}</b>`],
  [`<b>Resultado líquido ${s.resultadoParcial ? "PARCIAL" : "apurado"}</b>`, `<b>${R(r.resultado)}</b>`],
])}
${r.pendencias.length ? `<div class="al atencao"><b>Por que o resultado é parcial:</b><br>${r.pendencias.map(esc).join("<br>")}</div>` : ""}
<p class="note">A receita da Chegô não inclui valores das lojas (produtos) nem dos motoboys (entregas).</p>

<h2>6. Conciliação e divergências</h2>
${f.alertas.length ? f.alertas.map(alertaHtml).join("") : `<p class="note">Nenhuma divergência encontrada.</p>`}
<h3>Checagens feitas</h3>
<p class="note">Soma por modalidade = faturamento · produtos + entrega − desconto = total de cada pedido · cobrança confirmada no Asaas para cada pedido online · pedidos cancelados sem cobrança paga · mesma cobrança em mais de um pedido · Pix enviados duplicados ou sem identificação · movimentos manuais sem responsável · dinheiro esperado × conferido por motoboy.</p>
${f.ajustesAnteriores.length ? `<h3>Ajustes de dias anteriores (concluídos depois do corte)</h3><table><tr><th>Pedido</th><th>Loja</th><th>Dia</th><th>Status</th><th class="n">Total</th><th>Efeito</th></tr>${f.ajustesAnteriores.map(a => `<tr><td>${esc(a.codigo)}</td><td>${esc(a.loja)}</td><td>${dataBr(a.dia)}</td><td>${esc(a.status)}</td><td class="n">${R(a.total)}</td><td>${esc(a.efeito)}</td></tr>`).join("")}</table>` : ""}
${f.cancelados.length ? `<h3>Pedidos cancelados</h3><table><tr><th>Pedido</th><th>Loja</th><th>Pagamento</th><th class="n">Total</th><th>Motivo</th><th>Asaas</th></tr>${f.cancelados.map(c => `<tr><td>${esc(c.codigo)}</td><td>${esc(c.loja)}</td><td>${FORMA[c.forma] ?? esc(c.forma)}</td><td class="n">${R(c.total)}</td><td>${esc(c.motivo ?? "—")}</td><td>${esc(c.asaasStatus ?? "—")}</td></tr>`).join("")}</table>` : ""}

<h2>Anexo — pedidos concluídos do dia</h2>
<table><tr><th>Pedido</th><th>Loja</th><th>Motoboy</th><th>Pagamento</th><th class="n">Produtos</th><th class="n">Entrega</th><th class="n">Desc.</th><th class="n">Total</th><th class="n">Comissão</th><th class="n">Taxa pgto</th><th class="n">R$ 1 entr.</th><th class="n">Líq. loja</th><th class="n">Motoboy</th><th class="n">Taxa Asaas</th></tr>${pedidos}</table>
<p class="note">Relatório gerado automaticamente. Não altera valores nem executa repasses. Campos sem informação no sistema aparecem como "—" ou "sem conferência".</p>
</main></body></html>`
}

export async function excelFechamento(f: Fechamento): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Chegô Delivery"
  const money = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
  const aba = (nome: string, cols: { h: string; k: string; w?: number; m?: boolean }[], rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(nome)
    ws.columns = cols.map(c => ({ header: c.h, key: c.k, width: c.w ?? (c.m ? 14 : 22), style: c.m ? { numFmt: money } : {} }))
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" }
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } }
    for (const r of rows) ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 100) / 100 : v])))
    ws.eachRow(row => row.eachCell(c => { c.font = { ...(c.font ?? {}), name: "Arial" } }))
    ws.views = [{ state: "frozen", ySplit: 1 }]
    return ws
  }
  const s = f.resumo, r = f.receita
  aba("Resumo geral", [{ h: "Indicador", k: "k", w: 60 }, { h: "Valor", k: "v", w: 18 }], [
    { k: `Data`, v: dataBr(f.data) }, { k: "Gerado em", v: hora(f.corteEm) }, { k: "Última atualização considerada", v: hora(f.ultimoMovimentoEm) },
    { k: "Pedidos realizados", v: s.pedidosRealizados }, { k: "Pedidos concluídos", v: s.concluidos }, { k: "Pedidos cancelados", v: s.cancelados },
    { k: "Em andamento no corte", v: s.emAndamento }, { k: "Aguardando pagamento (não pagos)", v: s.aguardandoPagamento },
    { k: "Faturamento bruto", v: s.faturamentoBruto }, { k: "Produtos vendidos", v: s.produtos }, { k: "Taxas de entrega", v: s.taxasEntrega },
    { k: "Descontos — custeados pela loja", v: s.descontosLoja }, { k: "Descontos — custeados pela Chegô", v: s.descontosChego }, { k: "Descontos — financiador não identificado", v: s.descontosNaoIdentificados },
    { k: "Comissões da Chegô", v: s.comissoes }, { k: "Devido aos estabelecimentos (vendas do dia)", v: s.devidoLojas }, { k: "Devido aos motoboys (entregas do dia)", v: s.devidoMotoboys },
    { k: "Receita bruta do aplicativo", v: s.receitaBruta }, { k: "Custos identificados", v: s.custos }, { k: `Resultado líquido ${s.resultadoParcial ? "PARCIAL" : "apurado"}`, v: s.resultado },
    {}, { k: "POR MODALIDADE" }, ...f.porForma.map(x => ({ k: `${FORMA[x.forma] ?? x.forma} — ${x.pedidos} pedidos — recebido por: ${x.recebidoPor}`, v: x.valor })),
  ]).getColumn("v").numFmt = money
  aba("Resultado por loja", [
    { h: "Loja", k: "nome", w: 32 }, { h: "Pedidos", k: "pedidos", w: 9 }, { h: "Produtos", k: "produtos", m: true }, { h: "Descontos", k: "descontos", m: true },
    { h: "Comissão %", k: "comissaoPct", w: 11 }, { h: "Valor comissão", k: "comissao", m: true }, { h: "R$ 1 por entrega", k: "participacaoEntrega", m: true },
    { h: "Taxa pagamento", k: "taxaPagamento", m: true }, { h: "Já recebido pela loja", k: "recebidoPelaLoja", m: true }, { h: "Outros ajustes", k: "outrosAjustes", m: true },
    { h: "Líquido do dia", k: "liquido", m: true }, { h: "Pix enviado no dia (informativo)", k: "repassadoDia", m: true }, { h: "A repassar (do dia)", k: "pendenteAtual", m: true },
  ], f.lojas as unknown as Record<string, unknown>[])
  aba("Fechamento por motoboy", [
    { h: "Motoboy", k: "nome", w: 30 }, { h: "Entregas", k: "entregas", w: 9 }, { h: "Avulsas", k: "entregasAvulsas", w: 8 }, { h: "Ganho avulsas", k: "ganhoAvulsas", m: true }, { h: "Pix", k: "entregasPix", w: 6 }, { h: "Dinheiro", k: "entregasDinheiro", w: 8 }, { h: "Cartão", k: "entregasCartao", w: 7 },
    { h: "Dinheiro recebido", k: "dinheiroRecebido", m: true }, { h: "Maquininha", k: "outrasModalidades", m: true }, { h: "Taxas dele", k: "ganho", m: true },
    { h: "Complemento piso", k: "complementoPiso", m: true }, { h: "Bônus", k: "bonus", m: true }, { h: "Descontos", k: "descontos", m: true }, { h: "Retiradas", k: "retiradasDinheiro", m: true },
    { h: "Adiantamentos no dia", k: "pagamentosRecebidos", m: true }, { h: "A receber do dia", k: "saldoReceber", m: true }, { h: "Pagamentos enviados no dia (informativo)", k: "pagamentosInfo", m: true }, { h: "Ajuda de custo semanal (à parte)", k: "ajudaCustoInfo", m: true },
    { h: "Dinheiro a prestar contas", k: "dinheiroSobResponsabilidade", m: true }, { h: "Saldo final", k: "saldoFinal", m: true },
  ], f.motoboys as unknown as Record<string, unknown>[])
  aba("Controle de dinheiro", [
    { h: "Motoboy", k: "nome", w: 30 }, { h: "Recebido no dia", k: "dinheiroRecebido", m: true },
    { h: "Retiradas", k: "retiradasDinheiro", m: true }, { h: "Entregue ao caixa", k: "dinheiroEntregueCaixa", m: true }, { h: "Pag. autorizados", k: "dinheiroPagamentosAutorizados", m: true },
    { h: "Esperado em mãos", k: "dinheiroSobResponsabilidade", m: true }, { h: "Conferido", k: "conferido", m: true }, { h: "Diferença", k: "divergenciaCaixa", m: true }, { h: "Origem da conferência", k: "conferidoOrigem", w: 34 },
  ], f.motoboys as unknown as Record<string, unknown>[])
  const wsMov = wb.getWorksheet("Controle de dinheiro")!
  wsMov.addRow([]); wsMov.addRow(["MOVIMENTAÇÕES DO DIA"]).font = { bold: true, name: "Arial" }
  wsMov.addRow(["Data/hora", "Quem", "Tipo", "Forma", "Valor", "Responsável", "Motivo"]).font = { bold: true, name: "Arial" }
  for (const m of f.movimentosDia) { const row = wsMov.addRow([hora(m.ocorrido_em), m.nome, TIPO_MOV[m.tipo] ?? m.tipo, m.forma ?? "", m.valor, m.responsavel ?? "", m.motivo]); row.getCell(5).numFmt = money }
  aba("Receita e resultado", [{ h: "Item", k: "k", w: 60 }, { h: "Valor", k: "v", w: 18 }], [
    { k: "Receita de comissões", v: r.comissoes }, { k: "Receita das cobranças de R$ 1,00 por entrega", v: r.participacaoEntrega }, { k: "Taxas de pagamento cobradas das lojas", v: r.taxasPagamentoCobradas },
    { k: "Mensalidades recebidas", v: r.mensalidades }, { k: "Outras receitas", v: r.outrasReceitas }, { k: "RECEITA TOTAL", v: r.receitaTotal },
    { k: "(−) Taxas de processamento (Asaas)", v: r.taxasProcessamento }, { k: "(−) Cupons custeados pela Chegô", v: r.cuponsChego }, { k: "(−) Complemento do mínimo R$ 4,00", v: r.complementoPiso },
    { k: "(−) Bônus e incentivos", v: r.bonus }, { k: "(−) Pagamentos autorizados em dinheiro", v: r.pagamentosAutorizados }, { k: "(−) Despesas cadastradas", v: r.despesas },
    { k: "CUSTOS TOTAIS", v: r.custosTotal }, { k: `RESULTADO LÍQUIDO ${s.resultadoParcial ? "PARCIAL" : "APURADO"}`, v: r.resultado },
    {}, ...r.pendencias.map(p => ({ k: `Pendência: ${p}` })),
  ]).getColumn("v").numFmt = money
  aba("Divergências e conciliação", [{ h: "Nível", k: "nivel", w: 10 }, { h: "Alerta", k: "titulo", w: 44 }, { h: "Detalhe", k: "detalhe", w: 80 }, { h: "Pedido", k: "pedido", w: 10 }, { h: "Responsável", k: "responsavel", w: 26 }, { h: "Valor", k: "valor", m: true }],
    f.alertas as unknown as Record<string, unknown>[])
  aba("Pedidos do dia", [
    { h: "Pedido", k: "codigo", w: 10 }, { h: "Criado em", k: "hora", w: 13 }, { h: "Loja", k: "loja", w: 28 }, { h: "Motoboy", k: "motoboy", w: 26 }, { h: "Pagamento", k: "forma", w: 12 }, { h: "Recebido por", k: "receb", w: 18 },
    { h: "Produtos", k: "produtos", m: true }, { h: "Entrega", k: "entrega", m: true }, { h: "Desconto", k: "desconto", m: true }, { h: "Total", k: "totalCliente", m: true },
    { h: "Comissão %", k: "comissaoPct", w: 10 }, { h: "Comissão", k: "comissao", m: true }, { h: "Taxa pgto", k: "taxaPagamento", m: true }, { h: "R$ 1 entrega", k: "participacaoEntrega", m: true },
    { h: "Já recebido pela loja", k: "recebidoPelaLoja", m: true }, { h: "Líquido loja", k: "liquidoLoja", m: true }, { h: "Motoboy", k: "ganhoMotoboy", m: true }, { h: "Taxa Asaas real", k: "asaasTaxa", m: true },
  ], f.pedidos.map(p => ({ ...p, hora: hora(p.criado_em), receb: RECEB[p.recebidoPor] })))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export function emailFechamento(f: Fechamento): { assunto: string; html: string } {
  const s = f.resumo
  const crit = f.alertas.filter(a => a.nivel === "critico"), aten = f.alertas.filter(a => a.nivel === "atencao")
  const linha = (k: string, v: string, b = false) => `<tr><td style="padding:4px 10px 4px 0;color:#374151">${k}</td><td style="padding:4px 0;text-align:right;${b ? "font-weight:800" : ""}">${v}</td></tr>`
  return {
    assunto: `CHEGÔ | Fechamento Financeiro Diário | ${dataBr(f.data)}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#16181d;max-width:640px">
<h2 style="margin:0 0 4px">Fechamento financeiro — ${dataBr(f.data)}</h2>
<p style="color:#6b7280;margin:0 0 14px;font-size:13px">Gerado em ${hora(f.corteEm)} · última atualização considerada ${hora(f.ultimoMovimentoEm)}</p>
<table style="font-size:14px;border-collapse:collapse;width:100%">
${linha("Pedidos concluídos / cancelados", `${s.concluidos} / ${s.cancelados}`)}
${linha("Faturamento bruto", R(s.faturamentoBruto))}
${linha("Produtos / taxas de entrega", `${R(s.produtos)} / ${R(s.taxasEntrega)}`)}
${linha("Comissões da Chegô", R(s.comissoes))}
${linha("Receita bruta do app", R(s.receitaBruta))}
${linha("Custos identificados", R(s.custos))}
${linha(`Resultado ${s.resultadoParcial ? "PARCIAL" : "apurado"}`, R(s.resultado), true)}
${linha("Devido às lojas (vendas do dia)", R(s.devidoLojas))}
${linha("Devido aos motoboys (entregas do dia)", R(s.devidoMotoboys))}
${linha("Dinheiro em espécie recebido pelos motoboys no dia", R(f.motoboys.reduce((a, m) => a + m.dinheiroSobResponsabilidade, 0)), true)}
</table>
<h3 style="margin:18px 0 6px">Por modalidade</h3>
<table style="font-size:13px;border-collapse:collapse;width:100%">${f.porForma.map(x => linha(`${FORMA[x.forma] ?? x.forma} (${x.pedidos})`, R(x.valor))).join("")}</table>
<h3 style="margin:18px 0 6px">Alertas</h3>
${crit.length + aten.length ? [...crit, ...aten].map(a => `<div style="margin:6px 0;padding:8px 10px;border-radius:8px;font-size:13px;background:${a.nivel === "critico" ? "#fef2f2;border:1px solid #fca5a5" : "#fffbeb;border:1px solid #fcd34d"}"><b>${esc(a.titulo)}</b>${a.valor !== undefined ? ` — ${R(a.valor)}` : ""}<br>${esc(a.detalhe)}${a.pedido ? ` · Pedido ${esc(a.pedido)}` : ""}</div>`).join("") : `<p style="font-size:13px">Nenhuma divergência financeira.</p>`}
${s.resultadoParcial ? `<p style="font-size:12px;color:#92400e">Resultado parcial: ${esc(f.receita.pendencias.join(" "))}</p>` : ""}
<p style="font-size:12px;color:#6b7280;margin-top:16px">Em anexo: relatório detalhado em PDF e planilha Excel (resumo, lojas, motoboys, dinheiro, receita e conciliação). Gerado automaticamente — não altera valores nem executa repasses.</p>
</div>`,
  }
}
