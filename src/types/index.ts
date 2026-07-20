export type StatusLoja = "pendente" | "aprovado" | "contrato_assinado" | "ativo" | "suspenso"
export type PlanoLoja = "select" | "prime" | "black" | "gold"
export type StatusMotoboy = "pendente" | "aprovado" | "contrato_assinado" | "ativo" | "suspenso" | "offline"
export type StatusPedido = "aguardando_pagamento" | "pendente" | "aceito" | "preparando" | "pronto" | "aguardando_aceite" | "indo_para_loja" | "na_loja" | "em_rota" | "coletado" | "entregue" | "cancelado"
export type FormaPagamento = "pix" | "cartao" | "dinheiro" | "maquininha" | "google_pay"
export type CategoriaLoja = "Restaurante" | "Mercadinho" | "Farmácia" | "Outros" | "Hambúrguer" | "Pizza" | "Italiana" | "Japonês" | "Lanches" | "Bebidas" | "Doces e Bolos" | "Mercado"

export interface Loja {
  id: string
  nome: string
  descricao: string
  categoria: CategoriaLoja
  logo_url: string
  endereco: string
  telefone: string
  taxa_entrega: number
  tempo_min: number
  tempo_max: number
  status: StatusLoja
  aberto: boolean
  comissao: number
  criado_em: string
  nome_responsavel?: string
  email?: string
  cnpj?: string
  cpf_responsavel?: string
  pix_key?: string
  contrato_token?: string
  contrato_assinado?: boolean
  contrato_assinado_em?: string
  contrato_assinatura?: string | null
  motivo_rejeicao?: string
  nota_media?: number | null
  total_avaliacoes?: number | null
  plano?: PlanoLoja | null
  plano_ativo_desde?: string | null
  asaas_customer_id?: string | null
  asaas_subscription_id?: string | null
  asaas_wallet_id?: string | null
  modalidade_assinatura?: "digital" | "gov_br" | "presencial" | null
  contrato_pdf_url?: string | null
  // FASE 2 — dados fiscais
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  regime_tributario?: "mei" | "simples" | "lucro_presumido" | "lucro_real" | null
  cnae?: string | null
  nfce_serie?: number | null
  fiscal_ativo?: boolean | null
  focusnfe_cadastrado?: boolean | null
  // Endereço estruturado (para NFC-e)
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  // Credenciais e primeiro acesso
  primeiro_acesso?: boolean | null
  // FASE 3 — certificado digital e CSC
  cert_a1_path?: string | null
  cert_a1_expires_at?: string | null
  cert_a1_senha_vault_id?: string | null
  csc_id?: string | null
  csc_token_vault_id?: string | null
}

export interface EntregaAvulsa {
  id: string
  loja_id: string
  motoboy_id?: string | null
  cliente_nome: string
  cliente_tel: string
  endereco: string
  valor_pedido: number
  taxa_entrega: number
  observacao: string
  status: "aguardando" | "aceito" | "em_rota" | "entregue" | "cancelado"
  codigo: string
  criado_em: string
}

export interface Motoboy {
  id: string
  nome: string
  email: string
  telefone: string
  cpf: string
  veiculo: string
  placa: string
  status: StatusMotoboy
  disponivel: boolean
  criado_em: string
  cnh?: string
  pix_key?: string
  senha?: string | null
  contrato_token?: string
  contrato_assinado?: boolean
  contrato_assinado_em?: string
  contrato_assinatura?: string | null
  motivo_rejeicao?: string
  raio_km?: number
  documentos?: {
    cnhFrente?: string
    cnhVerso?: string
    crlv?: string
    selfie?: string
  } | null
  selfie_contrato?: string | null
  modalidade_assinatura?: "digital" | "gov_br" | "presencial" | null
  contrato_pdf_url?: string | null
  push_subscription?: unknown | null
  lat?: number | null
  lng?: number | null
}

export interface AdicionalProduto {
  id: string
  nome: string
  preco: number
}

export interface GrupoAdicional {
  id: string
  nome: string
  obrigatorio: boolean
  minimo: number
  maximo: number
  itens: AdicionalProduto[]
}

export interface Produto {
  id: string
  loja_id: string
  categoria_id: string | null
  nome: string
  descricao: string
  preco: number
  foto_url: string
  disponivel: boolean
  criado_em: string
  adicionais?: (AdicionalProduto | GrupoAdicional)[]
  dias_semana?: number[]  // 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sáb — vazio = todos os dias
  ncm?: string | null     // Nomenclatura Comum do Mercosul (para NFC-e)
}

export interface CategoriaProduto {
  id: string
  loja_id: string
  nome: string
  ordem: number
  foto_url?: string | null
  cardapio_do_dia?: boolean
  horario_inicio?: string | null
  horario_fim?: string | null
  dias_semana?: number[] | null
}

export interface ItemPedido {
  id: string
  pedido_id: string
  produto_id: string
  nome: string
  preco: number
  quantidade: number
  observacao: string
  adicionais?: AdicionalProduto[]
}

export interface Pedido {
  id: string
  codigo: string
  loja_id: string
  motoboy_id: string | null
  status: StatusPedido
  forma_pagamento: FormaPagamento
  subtotal: number
  taxa_entrega: number
  total: number
  endereco_entrega: string
  observacao: string
  criado_em: string
  aceito_em?: string | null
  pronto_em?: string | null
  coletado_em?: string | null
  entregue_em?: string | null
  nome_cliente?: string
  telefone_cliente?: string
  foto_entrega?: string
  loja?: Loja
  motoboy?: Motoboy
  itens?: ItemPedido[]
}
