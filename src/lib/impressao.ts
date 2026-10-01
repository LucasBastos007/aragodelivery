import type { Pedido, ItemPedido, AdicionalProduto } from "@/types"
import { PGTO } from "./pedidoLabels"

// Extraído de src/app/loja/page.tsx (Fase 3) em 2026-09-23 pra ser reutilizado também
// pelo Histórico (Fase 4) — mesma implementação, nunca duas. Conteúdo/HTML/CSS idênticos
// ao que já estava aprovado em produção; só mudou de arquivo. Só depende dos campos do
// próprio Pedido — nenhuma etapa aqui assume que o pedido ainda está em operação ativa,
// por isso funciona igual pra imprimir um pedido do dia ou reimprimir um pedido antigo
// do Histórico.
export function imprimirPedido(pedido: Pedido, largura: "80mm" | "58mm" = "80mm", reimpressao = false) {
  const now  = new Date(pedido.criado_em)
  const data = now.toLocaleDateString("pt-BR")
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  const itensHtml = (pedido.itens ?? []).map((i: ItemPedido) => {
    const adicionaisHtml = (i.adicionais ?? []).map((a: AdicionalProduto) =>
      `<tr><td colspan="2" class="obs">  + ${a.nome}${a.preco > 0 ? ` R$ ${a.preco.toFixed(2).replace(".", ",")}` : ""}</td></tr>`
    ).join("")
    return `
    <tr>
      <td>${i.quantidade}x ${i.nome}</td>
      <td class="r">R$ ${(i.preco * i.quantidade).toFixed(2).replace(".", ",")}</td>
    </tr>
    ${adicionaisHtml}
    ${i.observacao ? `<tr><td colspan="2" class="obs">  obs: ${i.observacao}</td></tr>` : ""}
  `
  }).join("")

  const bodyW  = largura === "58mm" ? "54mm" : "76mm"
  const pageW  = largura
  const fsBase = largura === "58mm" ? "11px" : "12px"
  const fsBig  = largura === "58mm" ? "13px" : "14px"

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido #${pedido.codigo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fsBase};
      font-weight: 700;
      width: ${bodyW};
      padding: 3mm 3mm;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .r { text-align: right; white-space: nowrap; }
    .dash { border-top: 2px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .obs { font-size: 10px; padding-left: 8px; }
    .total-row td { font-size: ${fsBig}; padding-top: 5px; border-top: 2px solid #000; }
    .section { margin: 5px 0 3px; font-size: ${fsBig}; text-transform: uppercase; letter-spacing: 0.5px; }
    .codigo { font-size: 16px; letter-spacing: 1px; }
    @media print {
      body { margin: 0; }
      @page { margin: 2mm; size: ${pageW} auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:6px;">
    <img src="https://chegodelivery.com/logo-chego.jpg" alt="Chegô" style="width:64px;height:64px;object-fit:contain;border-radius:8px;" />
  </div>
  ${reimpressao ? `<div class="center" style="border:2px solid #000; padding:3px 0; margin-bottom:6px;"><p style="font-size:${fsBig}; letter-spacing:1px;">⚠ REIMPRESSÃO</p></div>` : ""}
  <div class="dash"></div>
  <p class="codigo">PEDIDO #${pedido.codigo}</p>
  <p>${data} às ${hora}</p>
  <div class="dash"></div>
  <p class="section">ITENS</p>
  <table>${itensHtml}</table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">R$ ${(pedido.subtotal ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    ${(pedido.desconto ?? 0) > 0 ? `<tr><td>Desconto (cupom)</td><td class="r">- R$ ${Number(pedido.desconto).toFixed(2).replace(".", ",")}</td></tr>` : ""}
    <tr><td>Taxa de entrega</td><td class="r">R$ ${(pedido.taxa_entrega ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="r">R$ ${pedido.total.toFixed(2).replace(".", ",")}</td></tr>
  </table>
  ${(pedido.desconto ?? 0) > 0 ? `
  <div class="dash"></div>
  <p class="obs" style="padding-left:0;">Cupom: ${pedido.cupom_codigo ?? "—"}</p>
  <p class="obs" style="padding-left:0;">Motivo: o app deu um desconto de R$ ${Number(pedido.desconto).toFixed(2).replace(".", ",")} pro cliente — o valor chega menor pro lojista por causa desse cupom, não é erro. A Chegô compensa esse valor no repasse.</p>
  ` : ""}
  <div class="dash"></div>
  <p>PAGAMENTO: ${PGTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}</p>
  ${pedido.forma_pagamento === "dinheiro" ? `<p>${pedido.troco_para ? `TROCO PARA: R$ ${Number(pedido.troco_para).toFixed(2).replace(".", ",")}` : "SEM TROCO"}</p>` : ""}
  ${pedido.nome_cliente ? `<div class="dash"></div><p class="section">CLIENTE</p><p>${pedido.nome_cliente}</p>${pedido.telefone_cliente ? `<p>Tel: ${pedido.telefone_cliente}</p>` : ""}` : ""}
  ${pedido.endereco_entrega ? `<div class="dash"></div><p class="section">ENDEREÇO DE ENTREGA</p><p>${pedido.endereco_entrega}</p>` : ""}
  ${pedido.observacao ? `<div class="dash"></div><p class="section">OBSERVAÇÃO</p><p>${pedido.observacao}</p>` : ""}
  <div class="dash"></div>
  <p class="center" style="font-size:13px;">*** CHEGÔ DELIVERY ***</p>
  <br><br>
</body>
</html>`

  const win = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    const img = win.document.querySelector("img")
    if (img && !img.complete) {
      img.onload = () => { win.print(); win.close() }
      img.onerror = () => { win.print(); win.close() }
      setTimeout(() => { win.print(); win.close() }, 3000)
    } else {
      setTimeout(() => { win.print(); win.close() }, 400)
    }
  }
}

// Proteção contra impressão acidental/duplicada — mesma lógica usada em Pedidos (Fase 3),
// agora compartilhada com o Histórico (Fase 4). `forcarReimpressao` é a única diferença de
// comportamento entre os dois consumidores: em Pedidos, só é reimpressão de verdade se
// esse MESMO pedido já tiver sido impresso nesta sessão (clique duplo/engano); no
// Histórico, o pedido já está encerrado — qualquer impressão de lá é conceitualmente uma
// reimpressão da via original, então o aviso "REIMPRESSÃO" sai sempre, mesmo no primeiro
// clique da sessão.
export function imprimirComProtecao(opts: {
  pedido: Pedido
  larguraPapel: "80mm" | "58mm"
  impressos: Record<string, string>
  setImpressos: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  forcarReimpressao?: boolean
}) {
  const { pedido, larguraPapel, impressos, setImpressos, forcarReimpressao = false } = opts
  const ultimaImpressao = impressos[pedido.id]
  let ehReimpressao = forcarReimpressao
  if (ultimaImpressao) {
    const hora = new Date(ultimaImpressao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    const msg = forcarReimpressao
      ? `Pedido #${pedido.codigo} já foi reimpresso às ${hora}. Reimprimir de novo?`
      : `Pedido #${pedido.codigo} já foi impresso às ${hora}. Imprimir de novo?`
    if (!confirm(msg)) return
    ehReimpressao = true
  }
  imprimirPedido(pedido, larguraPapel, ehReimpressao)
  setImpressos(prev => ({ ...prev, [pedido.id]: new Date().toISOString() }))
}
