// Extrato do processador: caixa da conta, separado da receita comercial.
export type CaixaProcessador={disponivel:boolean;entradas:number;saidas:number;taxas:number;movimentoLiquido:number;lancamentos:number;erro?:string}
export async function carregarCaixaProcessador(inicio:string,fim:string):Promise<CaixaProcessador>{
 const vazio={disponivel:false,entradas:0,saidas:0,taxas:0,movimentoLiquido:0,lancamentos:0}
 if(!process.env.ASAAS_API_KEY)return {...vazio,erro:'Conexão com o processador não configurada.'}
 try{let entradas=0,saidas=0,taxas=0,lancamentos=0
  for(let offset=0;offset<10000;offset+=100){
   const params=new URLSearchParams({startDate:inicio,finishDate:fim,offset:String(offset),limit:'100',order:'asc'})
   const res=await fetch(`${process.env.ASAAS_BASE_URL||'https://api.asaas.com/v3'}/financialTransactions?${params}`,{headers:{access_token:process.env.ASAAS_API_KEY,'User-Agent':'ChegoDelivery/1.0'},cache:'no-store',signal:AbortSignal.timeout(15000)})
   if(!res.ok)throw new Error('Não foi possível consultar o extrato do processador.')
   const data=await res.json() as {data:{id:string;value:number;type:string}[];hasMore:boolean}
   if(!Array.isArray(data.data))throw new Error('Extrato inválido.')
   for(const t of data.data){if(!Number.isFinite(Number(t.value)))throw new Error('Valor inválido no extrato.');const v=Math.round(Number(t.value)*100);if(v>=0)entradas+=v;else saidas-=v;if(t.type.endsWith('_FEE'))taxas-=v;lancamentos++}
   if(!data.hasMore)return {disponivel:true,entradas,saidas,taxas,movimentoLiquido:entradas-saidas,lancamentos}
  }throw new Error('Extrato excede o limite de conferência; reduza o período.')
 }catch{return {...vazio,erro:'Extrato indisponível. Os valores de caixa não foram considerados zero.'}}
}
