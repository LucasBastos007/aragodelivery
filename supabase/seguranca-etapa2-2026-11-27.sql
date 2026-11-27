-- ════════════════════════════════════════════════════════════════════════════
-- Segurança do banco do Chegô — ETAPA 2 (27/11/2026): dados pessoais do cliente
-- Rodar no Supabase › SQL Editor. A versão do app que já lê esses dados pelo servidor
-- (chego-v189, commit 46837cf) está no ar desde 27/11 ~00h20.
-- Para desfazer: seguranca-etapa2-2026-11-27-VOLTAR.sql
--
-- O que muda: o navegador (chave pública) para de ver nome, telefone, endereço, e-mail,
-- CPF e troco do cliente nos pedidos, o telefone dos motoboys e a tabela de entregas
-- avulsas. As outras colunas de pedidos continuam liberadas (o tempo real segue
-- funcionando). O servidor usa a service role e não é afetado.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 1. Pedidos: tudo o que já estava liberado, MENOS os dados do cliente
revoke select on public.pedidos from anon, authenticated;
grant select (id,codigo,loja_id,motoboy_id,status,forma_pagamento,subtotal,taxa_entrega,total,
  lat_entrega,lng_entrega,observacao,criado_em,atualizado_em,cliente_id,desconto,cupom_codigo,loja_lat,loja_lng,
  coletado_em,entregue_em,tipo,pix_copia_cola,aceito_em,pronto_em,cancelado_por,
  motivo_cancelamento,motivo_outro,tipo_cartao_entrega,frete_gratis,frete_absorvido_por,
  frete_absorvido_editado_por,frete_absorvido_editado_em,zona_rural,previsao_entrega_em,imprevisto_em,
  prioridade_motoboy,distancia_km,cancelado_em,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,
  pagamentos_online_confirmados,taxa_dinamica)
  on public.pedidos to anon, authenticated;

-- 2. Motoboys: tudo o que já estava liberado, MENOS o telefone
revoke select on public.motoboys from anon, authenticated;
grant select (id,nome,veiculo,placa,status,disponivel,criado_em,lat,lng,nota_media,total_avaliacoes,
  disponivel_atualizado_em,conta_teste,limite_pedidos_simultaneos,limite_pedidos,raio_km,cidade_fixa,foto,recusas,
  contrato_assinado)
  on public.motoboys to anon, authenticated;

-- 3. Entregas avulsas: fechada para a chave pública (o app lê pelo servidor)
revoke all on public.entregas_avulsas from anon, authenticated;

commit;

-- Conferência (deve listar só as colunas liberadas, sem nome_cliente/telefone_cliente/endereco_entrega):
-- select column_name from information_schema.column_privileges
--  where table_name = 'pedidos' and grantee = 'anon' and privilege_type = 'SELECT' order by 1;
