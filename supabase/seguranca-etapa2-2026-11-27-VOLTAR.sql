-- Desfaz a ETAPA 2 (27/11/2026): volta a liberar para a chave pública os dados do cliente
-- nos pedidos, o telefone dos motoboys e a tabela de entregas avulsas (como na etapa 1).
begin;
grant select (endereco_entrega,nome_cliente,telefone_cliente,troco_para) on public.pedidos to anon, authenticated;
grant select (telefone) on public.motoboys to anon, authenticated;
grant all on public.entregas_avulsas to anon, authenticated; -- padrão do Supabase antes da etapa 2
commit;
