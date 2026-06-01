import type { OrderStatus } from '../types/models'

type Cfg = { label: string; cls: string }

const STATUS_CFG: Record<OrderStatus, Cfg> = {
  recebido:   { label: 'Recebido',    cls: 'badgeBlue'   },
  em_lavagem: { label: 'Em lavagem',  cls: 'badgeYellow' },
  pronto:     { label: 'Pronto',      cls: 'badgeGreen'  },
  entregue:   { label: 'Entregue',    cls: 'badgeMuted'  },
  cancelado:  { label: 'Cancelado',   cls: 'badgeRed'    },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status.replaceAll('_', ' '), cls: 'badgeMuted' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}
