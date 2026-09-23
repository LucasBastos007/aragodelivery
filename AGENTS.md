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
em qualquer fuso. Ver `src/lib/periodoBrt.ts::diaEMinutosAgoraBrt` como referência do
padrão certo (a referência antiga `src/lib/horarios.ts::diaEMinutosBrasilia` não existe
mais no projeto — se você chegou aqui procurando por ela, é essa a atual). Já teve bug
real disso em `src/app/restaurante/[id]/page.tsx` (pizza do dia mostrando sempre o mesmo
sabor, e filtro de `dias_semana`/`horario_inicio`/`horario_fim` de produto e categoria
usando hora do navegador em vez de BRT — corrigido em 2026-09-23) e em
`src/app/loja/perfil/page.tsx::horariosEstaAberto` (calculava aberto/fechado da loja com
hora do navegador em vez de BRT — corrigido em 2026-09-22).

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

**Despacho de corrida pro motoboy** (corrigido em 2026-09-22, com verificação de novo
depois de um incidente de teste real — ver nota de segurança de ambiente abaixo). São
DUAS camadas, não uma:
1. **Lista passiva ("pronto")**: o app do motoboy (`src/app/motoboy/page.tsx::loadPedidos`)
   faz polling a cada 15s por TODO pedido com `status='pronto' AND motoboy_id IS NULL`
   (exceto retirada) e mostra numa lista que qualquer motoboy disponível pode abrir e
   aceitar diretamente — **sem precisar de nenhum push, sem a loja precisar clicar em
   nada**. É por isso que `status='pronto'` sozinho já é visível/aceitável por um
   motoboy real, mesmo sem chamar `/api/escalada`.
2. **Oferta ativa ("aguardando_aceite")**: quando a loja clica "Chamar motoboy" (ou o
   cron `re-escalar` dispara de novo depois de travado), `/api/escalada` muda o status
   pra `aguardando_aceite` e manda push HTTP pra TODOS os candidatos elegíveis ao mesmo
   tempo (não é "um motoboy só"), que aparece no app deles como um popup de oferta com
   timer de 30s. Se não sobrar candidato, o escalada reverte pra `pronto` (some o popup,
   volta a valer só a lista passiva). Motoboy aceita via `/api/motoboy/aceitar-corrida`
   (guarda atômica por `status='aguardando_aceite'`, só o primeiro que chegar ganha).

**Cuidado em teste — os DOIS status entram em despacho real, não só "aguardando_aceite"**:
como não existe ambiente de staging (ver nota abaixo), criar um pedido de teste com
`status='pronto'` já é visível/aceitável por um motoboy real na lista passiva, mesmo sem
chamar escalada — incidente real confirmado em 2026-09-22 (pedido de teste virou
`indo_para_loja` com motoboy real em menos de 2 minutos). Testes que criam pedido devem
usar só `pendente` ou `aceito`/`preparando` (nenhum desses aparece pro motoboy).

**Raio de despacho por distância** (`motoboys.raio_km`, coluna criada em 2026-09-23,
default 12): filtra candidato em TODOS os caminhos de oferta — push ativo
(`/api/escalada`), o aviso "🍳 pedido em preparo" que dispara quando a loja aceita
(`/api/loja/status-pedido::avisarMotoboysPedidoAceito`), e a lista passiva "pronto" +
checagem/realtime de "aguardando_aceite" (as duas últimas em
`src/app/motoboy/page.tsx`). Usa a localização AO VIVO do motoboy (GPS via
`myLat`/`myLng`), não uma "cidade" fixa cadastrada — separar cidades próximas (ex:
Guapó/Aragoiânia, ~13,5km entre si) depende do motoboy manter um raio menor que a
distância entre elas. Sem coordenada real da loja ou sem GPS do motoboy ainda carregado,
o filtro é pulado (mostra tudo) — nunca trava o despacho por falta de dado. Mexer nisso
sempre nos 4 lugares junto, senão um caminho ignora o raio enquanto os outros respeitam.

**Loja atendendo mais de uma cidade** (`lojas.cidades_atendidas`, coluna criada em
2026-09-23, `text[]`): usada só pra agrupamento/descoberta (seções "Lojas Abertas
{Cidade}" na home e filtro `/busca?cidade=`) — nunca pro cálculo de frete, que já é por
distância real (`tabela_frete`/raio em `src/lib/frete.ts`). Cidades tão perto uma da
outra (Guapó/Aragoiânia) fazem um raio automático por distância "misturar" as seções
(uma loja no centro de uma cidade fica quase tão perto do centro da outra quanto uma loja
de lá mesma) — por isso é lista manual por loja, não raio calculado.

**Saldo a pagar por beneficiário**: sempre `soma(max(0, ganho_i − pago_i))` por
loja/motoboy individualmente — nunca `max(0, soma(ganho) − soma(pago))` agregado, porque
isso deixa um beneficiário pago a mais mascarar a dívida real de outro.

**Asaas**: `ASAAS_API_KEY`/`ASAAS_BASE_URL` no `.env.local` — já teve incidente de chave
corrompida (backslash sobrando) que fazia toda chamada falhar silenciosamente e mostrar
R$0. Endpoints usados: `financialTransactions` (taxa real cobrada por transação) e
`/transfers` (repasses PIX reais).
