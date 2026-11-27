// Colunas que o navegador pode ler (24/11/2026). A chave pública do banco deixou de ver as
// colunas sensíveis (senha, CPF, Pix, banco, tokens, Asaas, certificado), então `select("*")`
// direto do navegador dá erro de permissão nessas tabelas. Use estas listas no lugar do "*".
// Se precisar de coluna nova numa tela pública, acrescente aqui E no GRANT do SQL de
// segurança (supabase/seguranca-2026-11-24.sql), senão a consulta falha.
// 27/11/2026 (etapa 2): saíram de PEDIDO_PUB nome/telefone/endereço/troco do cliente e de
// MOTOBOY_PUB o telefone. A tela completa esses dados com comPii() (lib/piiPedidos.ts).
// O `as "*"` é só pro TypeScript tipar o resultado como antes; o valor real é a lista.

export const LOJA_PUB =
  "id,nome,descricao,categoria,logo_url,endereco,telefone,taxa_entrega,tempo_min,tempo_max,status,aberto,comissao,criado_em," +
  "nota_media,total_avaliacoes,lat,lng,cep,numero,complemento,bairro,cidade,estado,horarios,logradouro,aceita_retirada," +
  "valor_minimo,plano,fiscal_ativo,entrega_avulsa_liberada,aceita_entrega,destaque,cidades_atendidas,ordem_home," +
  "participacao_entrega,primeiro_acesso,modalidade_assinatura,contrato_assinado" as "*"

export const MOTOBOY_PUB =
  "id,nome,veiculo,placa,status,disponivel,criado_em,lat,lng,nota_media,total_avaliacoes,disponivel_atualizado_em," +
  "conta_teste,limite_pedidos_simultaneos,limite_pedidos,raio_km,cidade_fixa,foto,recusas,contrato_assinado" as "*"

export const PEDIDO_PUB =
  "id,codigo,loja_id,motoboy_id,status,forma_pagamento,subtotal,taxa_entrega,total,lat_entrega,lng_entrega," +
  "observacao,criado_em,atualizado_em,cliente_id,desconto,cupom_codigo,loja_lat,loja_lng,coletado_em,entregue_em," +
  "tipo,pix_copia_cola,aceito_em,pronto_em,cancelado_por,motivo_cancelamento,motivo_outro," +
  "tipo_cartao_entrega,frete_gratis,frete_absorvido_por,frete_absorvido_editado_por,frete_absorvido_editado_em," +
  "zona_rural,previsao_entrega_em,imprevisto_em,prioridade_motoboy,distancia_km,cancelado_em,forma_pagamento_2," +
  "valor_pagamento_1,valor_pagamento_2,pagamentos_online_confirmados,taxa_dinamica" as "*"
