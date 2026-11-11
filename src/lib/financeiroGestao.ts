import { ganhoMotoboy, taxaMotoboy } from './comissao'
export type LinhaFinanceira = { taxa_dinamica?:number|string|null; id:string; codigo?:string; loja_id?:string; motoboy_id?:string|null; status:string; criado_em:string; forma_pagamento?:string; forma_pagamento_2?:string|null; valor_pagamento_1?:number|null; valor_pagamento_2?:number|null; tipo_cartao_entrega?:string|null; subtotal?:number; total?:number; taxa_entrega?:number; desconto?:number; cupom_codigo?:string|null; tipo?:string; comissao_valor?:number; subtotal_itens?:number }
export type LojaGestao = {id:string;nome:string;comissao:number|null;plano?:string;plano_mensalidade?:number|null}
export type MovimentoGestao = {id:string;status:string;valor?:number;tipo?:string;loja_id?:string;motoboy_id?:string;criado_em?:string;pago_em?:string;atualizado_em?:string;solicitado_em?:string;valor_aprovado?:number|null;valor_solicitado?:number;taxa_asaas?:number;taxa_saque?:number;pedido_id?:string;referencia?:string}
export const PETISCARIA='29f50d38-c46f-4274-81c4-9ab3cc1413e9'
export const PETISCARIA_EVENTO='1b65d44d-93de-4dd6-bb35-a20332546c8f'
export const percentualGestao=(id:string)=>id===PETISCARIA?0:id===PETISCARIA_EVENTO?null:10
export const dinheiro=(v:unknown)=>Math.round(Number(v??0)*100)
export const diaBrt=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(iso))
export function limitesPeriodo(inicio:string,fim:string){
 const valido=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
 if(!valido(inicio)||!valido(fim)||fim<inicio) throw new Error('Informe um período válido.')
 const start=new Date(`${inicio}T00:00:00-03:00`),end=new Date(`${fim}T00:00:00-03:00`);end.setUTCDate(end.getUTCDate()+1)
 if(end.getTime()-start.getTime()>366*86400000)throw new Error('Selecione no máximo 366 dias.')
 return {inicio:start.toISOString(),fim:end.toISOString()}
}
export function resumirFinanceiro(pedidos:LinhaFinanceira[],avulsas:LinhaFinanceira[],lojas:LojaGestao[],mensalidades:MovimentoGestao[],saques:MovimentoGestao[],reembolsos:MovimentoGestao[],inicio:string,fim:string){
 const noPeriodo=(d?:string)=>!!d&&diaBrt(d)>=inicio&&diaBrt(d)<=fim
 const porLoja=new Map(lojas.map(l=>[l.id,{id:l.id,nome:l.nome,plano:l.id===PETISCARIA?'Mensal · R$ 1.000':l.id===PETISCARIA_EVENTO?'A confirmar':'Comissão por pedido',percentual:percentualGestao(l.id),pedidos:0,vendas:0,comissao:0,avulsas:0,comissaoAvulsa:0}]))
 const modalidades:Record<string,{quantidade:number;valor:number}>={Dinheiro:{quantidade:0,valor:0},Pix:{quantidade:0,valor:0},'Pix na loja':{quantidade:0,valor:0},Débito:{quantidade:0,valor:0},Crédito:{quantidade:0,valor:0},'Cartão sem modalidade':{quantidade:0,valor:0}}
 const dias=new Map<string,{dia:string;pedidos:number;vendas:number;comissao:number}>()
 for(let t=Date.parse(inicio);t<=Date.parse(fim);t+=86400000){const dia=new Date(t).toISOString().slice(0,10);dias.set(dia,{dia,pedidos:0,vendas:0,comissao:0})}
 let vendas=0,comissao=0,motoboys=0,corteEntrega=0,cupons=0,fretes=0,comissaoAvulsa=0,semComissao=0,avulsasValor=0,avulsasFrete=0,avulsasMotoboy=0,avulsasQuantidade=0
 const entregues=pedidos.filter(p=>p.status==='entregue')
 for(const p of pedidos){const d=dias.get(diaBrt(p.criado_em));if(d)d.pedidos++}
 for(const p of entregues){
  const v=dinheiro(p.total),l=porLoja.get(p.loja_id??'');const c=l?.percentual==null?0:Math.round(dinheiro(p.subtotal)*Number(l.percentual)/100)
  if(l?.percentual==null)semComissao++
  vendas+=v;comissao+=c;fretes+=dinheiro(p.taxa_entrega)+dinheiro(p.taxa_dinamica);if(p.cupom_codigo)cupons+=dinheiro(p.desconto)
  if(p.motoboy_id&&p.tipo!=='retirada'){motoboys+=dinheiro(ganhoMotoboy(Number(p.taxa_entrega??0),p.criado_em))+dinheiro(p.taxa_dinamica);corteEntrega+=dinheiro(taxaMotoboy(Number(p.taxa_entrega??0),p.criado_em))}
  // Pagamento em 2 formas: cada parte entra na sua modalidade com o próprio valor
  const partesP=p.forma_pagamento_2?[{f:p.forma_pagamento,v:dinheiro(p.valor_pagamento_1)},{f:p.forma_pagamento_2,v:dinheiro(p.valor_pagamento_2)}]:[{f:p.forma_pagamento,v}]
  for(const parte of partesP){
  const fp=parte.f
  let forma=fp==='dinheiro'?'Dinheiro':fp==='pix'?'Pix':fp==='pix_loja'?'Pix na loja':fp==='cartao'?'Crédito':fp==='maquininha'?(p.tipo_cartao_entrega==='debito'?'Débito':p.tipo_cartao_entrega==='credito'?'Crédito':'Cartão sem modalidade'):'Não informado'
  modalidades[forma]??={quantidade:0,valor:0};modalidades[forma].quantidade++;modalidades[forma].valor+=parte.v
  }
  if(l){l.pedidos++;l.vendas+=v;l.comissao+=c}const d=dias.get(diaBrt(p.criado_em));if(d){d.vendas+=v;d.comissao+=c}
 }
 for(const a of avulsas.filter(a=>a.status==='entregue')){const l=porLoja.get(a.loja_id??'');const c=l?.percentual==null?0:Math.round(dinheiro(a.subtotal_itens)*l.percentual/100);if(l?.percentual==null)semComissao++;comissaoAvulsa+=c;avulsasQuantidade++;avulsasValor+=dinheiro(a.subtotal_itens);avulsasFrete+=dinheiro(a.taxa_entrega);if(a.motoboy_id)avulsasMotoboy+=dinheiro(ganhoMotoboy(Number(a.taxa_entrega??0),a.criado_em));if(l){l.avulsas++;l.comissaoAvulsa+=c}if(a.motoboy_id){motoboys+=dinheiro(ganhoMotoboy(Number(a.taxa_entrega??0),a.criado_em));corteEntrega+=dinheiro(taxaMotoboy(Number(a.taxa_entrega??0),a.criado_em))}}
 const pagos=saques.filter(s=>s.status==='pago'&&noPeriodo(s.pago_em))
 const mensalidadesPagas=mensalidades.filter(m=>m.status==='pago'&&noPeriodo(m.pago_em))
 const mensalidadesSemData=mensalidades.filter(m=>m.status==='descontado')
 const refs=reembolsos.filter(r=>noPeriodo(r.atualizado_em??r.solicitado_em))
 const sum=(a:MovimentoGestao[],field:keyof MovimentoGestao='valor')=>a.reduce((s,r)=>s+dinheiro(r[field]),0)
 return {inicio,fim,pedidos:pedidos.length,entregues:entregues.length,emAndamento:pedidos.filter(p=>!['entregue','cancelado','aguardando_pagamento'].includes(p.status)).length,aguardandoPagamento:pedidos.filter(p=>p.status==='aguardando_pagamento').length,cancelados:pedidos.filter(p=>p.status==='cancelado').length,vendas,comissao,comissaoAvulsa,avulsasQuantidade,avulsasValor,avulsasFrete,avulsasMotoboy,motoboys,corteEntrega,cupons,fretes,semComissao,
  receitaComercial:comissao+comissaoAvulsa+corteEntrega+sum(mensalidadesPagas),mensalidadesRecebidas:sum(mensalidadesPagas),mensalidadesSemData:mensalidadesSemData.length,
  mensalidadesPendentes:sum(mensalidades.filter(m=>m.status==='pendente')),repassesLojas:sum(pagos.filter(s=>s.tipo==='lojista')),repassesMotoboys:sum(pagos.filter(s=>s.tipo==='motoboy')),saquesSolicitados:sum(saques.filter(s=>s.status==='solicitado')),taxasSaqueRegistradas:sum(pagos,'taxa_asaas'),
  estornosConcluidos:refs.filter(r=>r.status==='concluido').reduce((s,r)=>s+dinheiro(r.valor_aprovado??r.valor_solicitado),0),estornosPendentes:reembolsos.filter(r=>['solicitado','aprovado','processando'].includes(r.status)).length,
  modalidades:Object.entries(modalidades).map(([nome,v])=>({nome,...v})),dias:[...dias.values()],lojas:[...porLoja.values()].filter(l=>l.pedidos||l.avulsas).sort((a,b)=>b.vendas-a.vendas),
  detalhes:pedidos.map(p=>({codigo:p.codigo||p.id,dia:diaBrt(p.criado_em),loja:porLoja.get(p.loja_id??'')?.nome||'Loja não identificada',status:p.status,forma:p.forma_pagamento_2?`${p.forma_pagamento} + ${p.forma_pagamento_2}`:p.forma_pagamento||'',total:dinheiro(p.total)}))}
}
export type ResumoGestao=ReturnType<typeof resumirFinanceiro>
