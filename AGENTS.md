<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Chegô / Arago Delivery — contexto operacional

Stack: Next.js (Turbopack) na Vercel, Supabase (Postgres + Storage + Auth própria via
cookie de sessão — **não** usa Supabase Auth). Deploy com `npx vercel --prod --yes`
(às vezes retorna "Not authorized" à toa — só rodar de novo, sempre funciona na 2ª
tentativa).

**Sem Supabase CLI/migration tool.** Qualquer DDL (`CREATE TABLE`, `ALTER TABLE`) tem
que ser rodado manualmente pelo dono do projeto no SQL Editor do Supabase — não dá pra
aplicar migration direto por aqui. Pra leitura/escrita de dados (não schema), o padrão é
escrever um script `.mjs` solto na raiz do projeto usando `@supabase/supabase-js` com a
service role key, rodar com `node --env-file=.env.local script.mjs`, e apagar o arquivo
depois. Não existe outra forma de rodar SQL ad-hoc.

**Service worker (`public/sw.js`)**: `CACHE_NAME` precisa ser incrementado (`chego-vN`
→ `chego-v(N+1)`) em todo deploy que mexe em rotas cacheadas pelo PWA (principalmente
`/motoboy`), senão o app do motoboy continua servindo o bundle JS antigo indefinidamente
mesmo depois do deploy — o usuário final precisa fechar e reabrir o app pra pegar a
versão nova.

**Fuso horário (BRT)**: todo cálculo de "hoje"/"agora" (dia da semana, horário de
funcionamento de loja, cardápio do dia) tem que usar
`Intl.DateTimeFormat(..., {timeZone:"America/Sao_Paulo"})` — nunca `Date.getDay()` /
`Date.getHours()` cru, porque a Vercel roda em UTC e o navegador do cliente pode estar
em qualquer fuso. Ver `src/lib/horarios.ts::diaEMinutosBrasilia` como referência do
padrão certo. Já teve bug real disso em `src/app/restaurante/[id]/page.tsx` (pizza do
dia mostrando sempre o mesmo sabor).

**`lojas.horarios`** (jsonb): `{ tipo: "sempre_aberto" | "por_horario", forcar_aberto:
bool, dias: { seg..dom: { aberto: bool, inicio: "HH:MM", fim: "HH:MM" } } }`.
`forcar_aberto` é um override manual independente do campo `lojas.aberto` (o toggle que
a loja usa no próprio painel) — checar os dois ao investigar "loja não abre".

**Split de taxa de entrega / comissão** (`src/lib/comissao.ts`): fórmula com corte de
data (`REGRA_FAIXAS_DESDE`) — pedidos antigos usam a fórmula legada, pedidos novos usam
a fórmula por faixa (taxa≥R$6 → motoboy=taxa−1/app=R$1; taxa<R$6 →
motoboy=taxa+1/app=R$0, loja deve R$1 de repasse ao motoboy). Isso alimenta saldo real
de saque — qualquer mudança aqui precisa threadar `criado_em` em todos os call sites
(grep por `taxaMotoboy(` e `ganhoMotoboy(`), nunca duplicar a fórmula localmente.

**Despacho de corrida pro motoboy**: o único jeito confiável de uma corrida aparecer no
app do motoboy (produção ou teste) é deixar `pedidos.status='pronto'` e
`motoboy_id=null` — isso entra na fila de broadcast que todo motoboy disponível
consulta a cada 15s. Atribuir `motoboy_id` direto + push notification **não** é
confiável (só aparece se o motoboy tocar na notificação).

**Saldo a pagar por beneficiário**: sempre `soma(max(0, ganho_i − pago_i))` por
loja/motoboy individualmente — nunca `max(0, soma(ganho) − soma(pago))` agregado, porque
isso deixa um beneficiário pago a mais mascarar a dívida real de outro.

**Asaas**: `ASAAS_API_KEY`/`ASAAS_BASE_URL` no `.env.local` — já teve incidente de chave
corrompida (backslash sobrando) que fazia toda chamada falhar silenciosamente e mostrar
R$0. Endpoints usados: `financialTransactions` (taxa real cobrada por transação) e
`/transfers` (repasses PIX reais).
