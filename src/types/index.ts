export type StatusLoja = "pendente" | "aprovado" | "contrato_assinado" | "ativo" | "suspenso"
export type StatusMotoboy = "pendente" | "aprovado" | "contrato_assinado" | "ativo" | "suspenso" | "offline"
export type StatusPedido = "pendente" | "aceito" | "preparando" | "pronto" | "aguardando_aceite" | "indo_para_loja" | "na_loja" | "em_rota" | "coletado" | "entregue" | "cancelado"
export type FormaPagamento = "pix" | "cartao" | "dinheiro" | "maquininha" | "apple_pay" | "google_pay"
export type CategoriaLoja = "Restaurante" | "Mercadinho" | "Farmácia" | "Outros"

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
  motivo_rejeicao?: string
  nota_media?: number | null
  total_avaliacoes?: number | null
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
  motivo_rejeicao?: string
  raio_km?: number
  documentos?: {
    cnhFrente?: string
    cnhVerso?: string
    crlv?: string
    selfie?: string
  } | null
  selfie_contrato?: string | null
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
}

export interface CategoriaProduto {
  id: string
  loja_id: string
  nome: string
  ordem: number
}

export interface ItemPedido {
  id: string
  pedido_id: string
  produto_id: string
  nome: string
  preco: number
  quantidade: number
  observacao: string
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
  nome_cliente?: string
  telefone_cliente?: string
  foto_entrega?: string
  coletado_em?: string | null
  entregue_em?: string | null
  loja?: Loja
  motoboy?: Motoboy
  itens?: ItemPedido[]
}
