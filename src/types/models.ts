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
  whatsapp_opt_in?: boolean
  cobranca_pausada?: boolean
  ultima_cobranca_em?: string | null
  ativo: boolean
  deletado_em?: string | null
  criado_em: string
  atualizado_em: string
}

export type TipoPeca = {
  id: UUID
  nome: string
  descricao: string | null
  peso_referencia_kg: number | null
  preco_unitario?: number | null
  deletado_em?: string | null
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
  adicional_pecas?: number
  desconto_valor?: number | null
  desconto_tipo?: 'percentual' | 'fixo' | null
  observacoes: string | null
  foto_drive_id?: string | null
  deletado_em?: string | null
  criado_em: string
}

export type PedidoCliente = Pedido & {
  cliente: {
    id: string
    nome: string
    condominio: string | null
    bloco: string | null
    apartamento: string | null
    plano?: ClientePlano | null
  } | null
}

export type ItemPedidoPeca = {
  id_peca: string
  conferido: boolean
}

export type ItemPedido = {
  id: UUID
  pedido_id: UUID
  tipo_peca_id: UUID
  quantidade: number
  peso_linha_kg: number | null
  preco_unitario?: number
  pecas?: ItemPedidoPeca[] | null
  criado_em: string
}

export type Despesa = {
  id: UUID
  data: string
  categoria: string
  descricao: string | null
  valor: number
  vencimento?: string | null
  pago?: boolean | null
  data_pagamento?: string | null
  recorrente?: boolean
  deletado_em?: string | null
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
  capacidade_secagem_kg?: number | null
  litros_por_ciclo?: number | null
  energia_kwh_por_ciclo?: number | null
  ultima_manutencao?: string | null
  ciclos_desde_manutencao?: number
  device_id?: string | null
  ativo: boolean
  deletado_em?: string | null
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
  consumo_wh: number | null
  ciclos: number
  criado_em: string
}

export type Pagamento = {
  id: UUID
  pedido_id: UUID
  valor: number
  data: string
  forma: ClienteFormaPagamento
  observacoes: string | null
  registrado_por: UUID | null
  estornado_em: string | null
  criado_em: string
}

export type CobrancaEvento = {
  id: UUID
  cliente_id: UUID
  pedido_id: UUID | null
  canal: 'whatsapp' | 'telefone' | 'presencial' | 'outro'
  mensagem: string | null
  criado_por: UUID | null
  criado_em: string
}


export type ResumoMensal = {
  id: UUID
  mes_ano: string
  total_pedidos: number
  total_kg: number
  custo_energia: number
  custo_agua: number
  criado_em: string
  atualizado_em: string
}
