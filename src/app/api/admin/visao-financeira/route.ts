import {carregarCaixaProcessador} from '@/lib/asaasGestao'
import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {requireAdmin,unauthorized} from '@/lib/session'
import {diaBrt,limitesPeriodo,resumirFinanceiro,type LinhaFinanceira,type LojaGestao,type MovimentoGestao} from '@/lib/financeiroGestao'
import {calcularDestinacoes,type MensalidadeRecebida} from '@/lib/destinacoesFinanceiras'

// Mensalidades: cobranças pagas no Asaas por clientes que são LOJAS (nunca pedidos).
// Cache de 10 min por período — a tela atualiza a cada minuto.
const cacheMensal=new Map<string,{em:number;dados:MensalidadeRecebida[]}>()
async function mensalidadesAsaas(lojas:{nome:string;asaas_customer_id?:string|null}[],inicio:string,fim:string):Promise<MensalidadeRecebida[]>{
 const k=`${inicio}|${fim}`,hit=cacheMensal.get(k);if(hit&&Date.now()-hit.em<600000)return hit.dados
 const base=process.env.ASAAS_BASE_URL??'https://api.asaas.com/v3',out:MensalidadeRecebida[]=[]
 for(const l of lojas.filter(l=>l.asaas_customer_id)){
  const r=await fetch(`${base}/payments?customer=${l.asaas_customer_id}&paymentDate[ge]=${inicio}&paymentDate[le]=${fim}&limit=100`,{headers:{access_token:process.env.ASAAS_API_KEY!,'User-Agent':'ChegoDelivery/1.0'},cache:'no-store'})
  if(!r.ok)throw new Error(`Asaas HTTP ${r.status}`)
  const j=await r.json() as {data:{value:number;netValue:number;status:string;paymentDate?:string}[]}
  for(const p of j.data)if(['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(p.status))out.push({loja:l.nome,valor:Number(p.value),liquido:Number(p.netValue),data:p.paymentDate??'',origem:'Asaas'})
 }
 cacheMensal.set(k,{em:Date.now(),dados:out});return out
}
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 if(!requireAdmin(req))return unauthorized()
 const inicio=req.nextUrl.searchParams.get('inicio')||diaBrt(new Date().toISOString()),fim=req.nextUrl.searchParams.get('fim')||inicio
 let range:ReturnType<typeof limitesPeriodo>;try{range=limitesPeriodo(inicio,fim)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
 async function ler<T>(tabela:string,colunas:string,periodo=false):Promise<T[]>{
  const resultado:T[]=[]
  for(let offset=0;offset<100000;offset+=1000){let q=sb.from(tabela).select(colunas).order('id').range(offset,offset+999);if(periodo)q=q.gte('criado_em',range.inicio).lt('criado_em',range.fim)
   const {data,error}=await q;if(error)throw new Error(`Falha ao consultar ${tabela}`);resultado.push(...(data as unknown as T[]));if((data?.length??0)<1000)return resultado
  }throw new Error('Volume acima do limite de conferência. Reduza o período.')
 }
 try{
  const [pedidos,avulsas,lojas,mensalidades,saques,reembolsos,caixa]=await Promise.all([
   ler<LinhaFinanceira>('pedidos','id,codigo,loja_id,motoboy_id,status,criado_em,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,tipo_cartao_entrega,subtotal,total,taxa_entrega,taxa_dinamica,desconto,cupom_codigo,tipo,endereco_entrega,frete_gratis,frete_absorvido_por',true),
   ler<LinhaFinanceira>('entregas_avulsas','id,codigo,loja_id,motoboy_id,status,criado_em,taxa_entrega,comissao_valor,subtotal_itens',true),
   ler<LojaGestao&{participacao_entrega:number;asaas_customer_id:string|null}>('lojas','id,nome,comissao,plano,plano_mensalidade,participacao_entrega,asaas_customer_id'),ler<MovimentoGestao>('mensalidades','*'),
   ler<MovimentoGestao>('saques','id,tipo,loja_id,motoboy_id,valor,status,criado_em,pago_em,taxa_asaas,taxa_saque'),
   ler<MovimentoGestao>('reembolsos','id,pedido_id,status,solicitado_em,atualizado_em,valor_aprovado,valor_solicitado'),carregarCaixaProcessador(inicio,fim)
  ])
  const [cupons,motoboys,{data:movs,error:movErr}]=await Promise.all([ler<{codigo:string;loja_id:string|null}>('cupons','id,codigo,loja_id'),ler<{id:string;nome:string;ajuda_custo_semanal:number;ajuda_custo_dia_semana:number}>('motoboys','id,nome,ajuda_custo_semanal,ajuda_custo_dia_semana'),
   sb.from('movimentos_financeiros').select('tipo,valor,loja_id,motoboy_id,ocorrido_em,origem,cancelado_em').gte('ocorrido_em',range.inicio).lt('ocorrido_em',range.fim).limit(5000)])
  if(movErr)throw new Error('Falha ao consultar movimentos_financeiros')
  let mensAsaas:MensalidadeRecebida[]=[],mensErro:string|null=null
  try{mensAsaas=await mensalidadesAsaas(lojas,inicio,fim)}catch(e){mensErro=(e as Error).message}
  const mensTabela=(mensalidades as (MovimentoGestao&{loja_id?:string})[]).filter(m=>m.status==='pago'&&m.pago_em&&diaBrt(m.pago_em)>=inicio&&diaBrt(m.pago_em)<=fim).map(m=>({loja:lojas.find(l=>l.id===m.loja_id)?.nome??'—',valor:Number(m.valor??0),liquido:Number(m.valor??0),data:diaBrt(m.pago_em!),origem:'Cadastro'}))
  const destinacoes=calcularDestinacoes({pedidos:pedidos as never,avulsas:avulsas as never,lojas,cupons,motoboys,movimentos:(movs??[]) as never,saques:saques as never,mensalidades:[...mensAsaas,...mensTabela.filter(t=>!mensAsaas.some(m=>m.loja===t.loja&&Math.abs(m.valor-t.valor)<0.01&&m.data===t.data))],mensalidadesErro:mensErro,inicio,fim})
  return NextResponse.json({...resumirFinanceiro(pedidos,avulsas,lojas,mensalidades,saques,reembolsos,inicio,fim),destinacoes,caixa,atualizadoEm:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('[visao-financeira]',(e as Error).message);return NextResponse.json({error:'Não foi possível conferir todos os dados financeiros. Tente atualizar novamente.'},{status:503})}
}
