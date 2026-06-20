export type UUID = string

export type OrderStatus = 'recebido' | 'em_lavagem' | 'pronto' | 'entregue' | 'cancelado'

export type ClientePlano = 'pagou' | 'mensal' | 'quinzenal' | 'vaneide'
export type ClienteFormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro'
export type PagamentoStatus = 'pago' | 'devendo' | 'em_andamento'

export type Cliente = {
  id: UUID
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  condominio: string | null
  bloco: string | null
  apartamento: string | null
  plano: ClientePlano
  forma_pagamento: ClienteFormaPagamento
  dia_pagamento: number | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export type TipoPeca = {
  id: UUID
  nome: string
  descricao: string | null
  peso_referencia_kg: number | null
  criado_em: string
}

export type Pedido = {
  id: UUID
  cliente_id: UUID
  data_pedido: string
  data_prevista_entrega: string | null
  status: OrderStatus
  pagamento_status: PagamentoStatus
  peso_kg: number
  preco_por_kg: number | null
  preco_fixo: number | null
  observacoes: string | null
  foto_drive_id?: string | null
  criado_em: string
}

export type PedidoCliente = Pedido & {
  cliente: {
    id: string
    nome: string
    condominio: string | null
    bloco: string | null
    apartamento: string | null
  } | null
}

export type ItemPedido = {
  id: UUID
  pedido_id: UUID
  tipo_peca_id: UUID
  quantidade: number
  peso_linha_kg: number | null
  criado_em: string
}

export type Despesa = {
  id: UUID
  data: string
  categoria: string
  descricao: string | null
  valor: number
  criado_em: string
}

export type MaquinaTipo = 'lavagem' | 'secagem'

export type Maquina = {
  id: UUID
  nome: string
  tipo: MaquinaTipo
  capacidade_kg: number
  minutos_por_ciclo: number | null
  ciclos_por_dia_util: number
  ativo: boolean
  criado_em: string
}

export type AppConfig = {
  id: UUID
  dias_uteis_mes_padrao: number
  preco_referencia_kg: number
  custo_variavel_estimado_por_kg: number
  webhook_url: string | null
  criado_em: string
  atualizado_em: string
}


export type ConsumoMaquina = {
  id: UUID
  maquina_id: UUID
  mes_ano: string
  consumo_wh: number
  criado_em: string
}
