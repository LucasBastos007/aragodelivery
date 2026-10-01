-- Fase 4 (Histórico) — RPC pra corrigir o gargalo real achado na auditoria: o total de
-- vendas do período era calculado buscando TODOS os pedidos entregues do período pro
-- front e somando em JavaScript (uma loja de alto volume com período "Total" chegava a
-- trazer milhares de linhas só pra uma soma). Agora a soma acontece no banco.
--
-- Regra: só "entregue" conta como venda real — mesma regra de src/lib/statusPedido.ts::
-- pedidoValido(), já usada em Financeiro/Relatório. Não duplica lógica nova.
--
-- RODAR MANUALMENTE no SQL Editor do projeto DEV (aragodelivery-dev, ref
-- stndcgeurgdjtzxhhrwn) — igual todo DDL deste projeto (ver AGENTS.md). NÃO rodar em
-- produção ainda; isso é parte do "trabalhar só em DEV" desta fase.
--
-- *** NÃO EXECUTAR AINDA (checkpoint corretivo, 2026-09-23) ***
-- A função abaixo é só leitura/agregação, filtra por loja e período, e só soma
-- "entregue" — nesse sentido está correta. MAS: ela recebe p_loja_id como parâmetro
-- vindo do cliente, e hoje não existe nenhuma validação de sessão no servidor que
-- confirme que quem chama tem permissão sobre aquela loja (mesmo problema sistêmico já
-- mapeado no PLANO DE SEGURANÇA — loja_id do localStorage, RLS de pedidos allow_all,
-- acesso direto do browser à anon key). Qualquer chamador poderia trocar p_loja_id e
-- ver o faturamento de outra loja. Não há como tornar esse parâmetro seguro dentro da
-- arquitetura atual sem a migração de sessão/API server-side (que foi explicitamente
-- adiada pra uma fase própria). Por isso esta função NÃO deve ser criada/rodada ainda —
-- fica documentada aqui pra quando a fase de segurança acontecer. Até lá,
-- carregarTotalVendas() continua caindo no fallback (totalVendas = null).

create or replace function public.historico_total_vendas(
  p_loja_id uuid,
  p_inicio  timestamptz,
  p_fim     timestamptz
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(total), 0)
  from pedidos
  where loja_id = p_loja_id
    and status = 'entregue'
    and criado_em >= p_inicio
    and criado_em <= p_fim
$$;

-- O client acessa o Supabase direto do navegador com a anon key (mesmo padrão do
-- resto do projeto) — sem GRANT explícito o RPC fica invocável só pelo owner/service role.
grant execute on function public.historico_total_vendas(uuid, timestamptz, timestamptz) to anon, authenticated;
