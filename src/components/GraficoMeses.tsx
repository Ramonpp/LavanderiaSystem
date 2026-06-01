import { useState } from 'react'
import { formatBRL } from '../lib/format'

const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function mesAbrev(ym: string): string {
  const m = Number(ym.split('-')[1])
  return MESES_ABR[(m - 1) % 12] ?? ym
}

function fmtAxis(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export type PontoMes = { mes: string; receita: number; lucro: number }

const PAD = { top: 28, right: 24, bottom: 44, left: 68 }
const VW = 620
const VH = 280
const CW = VW - PAD.left - PAD.right
const CH = VH - PAD.top - PAD.bottom

interface Props {
  dados: PontoMes[]
}

export function GraficoMeses({ dados }: Props) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  if (dados.length === 0) {
    return <div className="hint" style={{ padding: 24 }}>Sem dados para exibir.</div>
  }

  const yMax = Math.max(...dados.map((d) => d.receita), ...dados.map((d) => d.lucro), 1) * 1.15
  const yMin = Math.min(...dados.map((d) => d.lucro), 0) * 1.15
  const yRange = yMax - yMin || 1

  const toY = (v: number) => PAD.top + CH - ((v - yMin) / yRange) * CH
  const zeroY = toY(0)

  const n = dados.length
  const slotW = CW / n
  const barW = Math.min(slotW * 0.48, 44)

  const gridVals = [0, 1, 2, 3, 4].map((i) => yMin + (yRange * i) / 4)

  const linePoints = dados.map((d, i) => ({
    x: PAD.left + slotW * i + slotW / 2,
    y: toY(d.lucro),
  }))

  const polyline = linePoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Grafico receita e lucro por mes"
      >
        {gridVals.map((v, i) => {
          const y = toY(v)
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + CW} y2={y}
                stroke="var(--border)" strokeWidth={v === 0 ? 1.5 : 1}
                strokeDasharray={v === 0 ? undefined : '4 3'}
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {fmtAxis(v)}
              </text>
            </g>
          )
        })}

        {dados.map((d, i) => {
          const cx = PAD.left + slotW * i + slotW / 2
          const bx = cx - barW / 2
          const barTop = Math.min(toY(d.receita), zeroY)
          const barH = Math.max(Math.abs(toY(d.receita) - zeroY), 1)
          const isHov = hovIdx === i
          return (
            <rect
              key={i}
              x={bx} y={barTop} width={barW} height={barH}
              fill="var(--accent)" opacity={isHov ? 1 : 0.75} rx={3}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
              style={{ cursor: 'default' }}
            />
          )
        })}

        <polyline
          points={polyline}
          fill="none"
          stroke="var(--ok)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {linePoints.map((p, i) => {
          const isPos = dados[i].lucro >= 0
          const isHov = hovIdx === i
          return (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r={isHov ? 6 : 4}
              fill={isPos ? 'var(--ok)' : 'var(--danger)'}
              stroke="var(--panel)" strokeWidth={2}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
              style={{ cursor: 'default' }}
            />
          )
        })}

        {dados.map((d, i) => (
          <text
            key={i}
            x={PAD.left + slotW * i + slotW / 2}
            y={VH - 10}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
          >
            {mesAbrev(d.mes)}
          </text>
        ))}

        {hovIdx !== null && (() => {
          const d = dados[hovIdx]
          const cx = PAD.left + slotW * hovIdx + slotW / 2
          const tw = 148
          const th = 68
          const tx = Math.min(Math.max(cx - tw / 2, PAD.left + 4), PAD.left + CW - tw - 4)
          const ty = PAD.top + 4
          return (
            <g pointerEvents="none">
              <rect
                x={tx} y={ty} width={tw} height={th} rx={6}
                fill="var(--panel)" stroke="var(--border)" strokeWidth={1}
              />
              <text x={tx + 10} y={ty + 18} fontSize={11} fontWeight="600" fill="var(--text-h)">
                {mesAbrev(d.mes)}/{d.mes.split('-')[0]}
              </text>
              <text x={tx + 10} y={ty + 36} fontSize={10} fill="var(--accent)">
                Receita: {formatBRL(d.receita)}
              </text>
              <text
                x={tx + 10} y={ty + 54} fontSize={10}
                fill={d.lucro >= 0 ? 'var(--ok)' : 'var(--danger)'}
              >
                Lucro: {formatBRL(d.lucro)}
              </text>
            </g>
          )
        })()}
      </svg>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <svg width={14} height={10}>
            <rect x={0} y={0} width={14} height={10} fill="var(--accent)" rx={2} opacity={0.8} />
          </svg>
          Receita
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <svg width={14} height={10}>
            <line x1={0} y1={5} x2={14} y2={5} stroke="var(--ok)" strokeWidth={2.5} />
            <circle cx={7} cy={5} r={3} fill="var(--ok)" />
          </svg>
          Lucro
        </span>
      </div>
    </div>
  )
}
