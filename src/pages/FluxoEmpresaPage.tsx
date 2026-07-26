import { useState } from 'react'

/* ── Fases do processo ─────────────────────────────────── */
type Phase = 'entrada' | 'triagem' | 'processo' | 'lavagem'

interface Step {
  title: string
  desc: string
  phase: Phase
  tips?: string[]
  icon: JSX.Element
  branches?: { label: string; color: string }[]
}

const PHASE_META: Record<Phase, { label: string; gradient: string; bg: string; border: string }> = {
  entrada:   { label: 'Entrada',     gradient: 'linear-gradient(135deg, #6366f1, #818cf8)', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)' },
  triagem:   { label: 'Triagem',     gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  processo:  { label: 'Processamento', gradient: 'linear-gradient(135deg, #10b981, #34d399)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
  lavagem:   { label: 'Lavagem',     gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
}

const steps: Step[] = [
  {
    title: 'Recebimento dos Pacotes',
    desc: 'Os pacotes de roupa do condomínio chegam à lavanderia. Cada pacote é identificado por apartamento/unidade.',
    phase: 'entrada',
    tips: ['Confira se o pacote está lacrado ou aberto', 'Registre o horário de chegada'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    )
  },
  {
    title: 'Contagem das Peças',
    desc: 'Faço a contagem de todas as peças recebidas no pacote para garantir que a quantidade bate com o esperado.',
    phase: 'entrada',
    tips: ['Compare com a lista do cliente (se houver)', 'Anote divergências imediatamente'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    )
  },
  {
    title: 'Verificação de Identificação',
    desc: 'Verifico se cada peça possui identificação. Caso não tenha, aplico a marcação com a caneta de tecido para rastreamento.',
    phase: 'triagem',
    tips: ['Use caneta de tecido permanente', 'Marque em local discreto (etiqueta interna)'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    )
  },
  {
    title: 'Registro no Aplicativo',
    desc: 'Coloco no aplicativo o ID do cliente/apartamento e a quantidade de peças para controle e rastreabilidade.',
    phase: 'triagem',
    tips: ['Informe o ID do pacote/apartamento', 'Confirme a quantidade antes de salvar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="13" y2="14" />
      </svg>
    )
  },
  {
    title: 'Separação por Tipo de Peça',
    desc: 'Separo as peças por categoria para organizar o processo de lavagem de forma eficiente.',
    phase: 'processo',
    branches: [
      { label: 'Lençóis', color: '#6366f1' },
      { label: 'Toalhas de Banho', color: '#f59e0b' },
      { label: 'Toalha de Piso', color: '#10b981' },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    )
  },
  {
    title: 'Classificação por Sujidade',
    desc: 'Após separar por tipo, classifico por nível de sujidade para definir o ciclo de lavagem adequado.',
    phase: 'processo',
    branches: [
      { label: 'Leve', color: '#10b981' },
      { label: 'Moderada', color: '#f59e0b' },
      { label: 'Pesada', color: '#ef4444' },
    ],
    tips: ['Peças muito encardidas podem precisar de pré-lavagem'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    )
  },
  {
    title: 'Lavagem em Lote',
    desc: 'Lavo juntos com peças de outros apartamentos que tenham o mesmo tipo e grau de sujidade, otimizando o uso das máquinas.',
    phase: 'lavagem',
    tips: [
      'Agrupe por sujidade semelhante',
      'Respeite a capacidade máxima da máquina',
      'Peças de apartamentos diferentes podem ir juntas'
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <circle cx="12" cy="13" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="4" y1="2" x2="4" y2="5" />
        <line x1="20" y1="2" x2="20" y2="5" />
        <line x1="2" y1="5" x2="22" y2="5" />
      </svg>
    )
  }
]

/* ── Componente ────────────────────────────────────────── */
export function FluxoEmpresaPage() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  return (
    <div className="anim-fade-in" style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>Organograma</h1>
        <p className="hint" style={{ fontSize: 14, margin: 0 }}>
          Processo completo de recebimento, triagem e lavagem das peças de condomínio.
        </p>
      </header>

      {/* Legenda de fases */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28
      }}>
        {Object.entries(PHASE_META).map(([key, ph]) => (
          <span key={key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, padding: '4px 12px',
            borderRadius: 20, background: ph.bg, border: `1px solid ${ph.border}`,
            color: 'var(--text-h)'
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: ph.gradient, flexShrink: 0
            }} />
            {ph.label}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Linha conectora */}
        <div style={{
          position: 'absolute', top: 28, bottom: 28,
          left: 27, width: 2,
          background: 'linear-gradient(to bottom, rgba(99,102,241,0.3), rgba(59,130,246,0.3))',
          zIndex: 0
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step, idx) => {
            const ph = PHASE_META[step.phase]
            const isExpanded = expandedIdx === idx
            const prevPhase = idx > 0 ? steps[idx - 1].phase : null
            const showPhaseDivider = prevPhase !== step.phase

            return (
              <div key={idx}>
                {/* Divisor de fase */}
                {showPhaseDivider && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 12, marginTop: idx === 0 ? 0 : 8, paddingLeft: 62
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: 'var(--muted)',
                      background: 'var(--bg)', padding: '0 8px', position: 'relative', zIndex: 1
                    }}>
                      {ph.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}

                {/* Etapa */}
                <div
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  style={{
                    display: 'flex', gap: 14, position: 'relative', zIndex: 1,
                    cursor: step.tips || step.branches ? 'pointer' : 'default',
                    animation: `fadeSlideIn 0.4s ease both`,
                    animationDelay: `${idx * 0.07}s`,
                  }}
                >
                  {/* Ícone circular */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: ph.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', flexShrink: 0,
                    boxShadow: `0 4px 14px -2px ${ph.border}`,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    ...(isExpanded ? { transform: 'scale(1.08)', boxShadow: `0 6px 20px -2px ${ph.border}` } : {})
                  }}>
                    <div style={{ width: 24, height: 24 }}>
                      {step.icon}
                    </div>
                  </div>

                  {/* Card da etapa */}
                  <div style={{
                    flex: 1, padding: '14px 18px',
                    background: 'var(--panel)',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${isExpanded ? ph.border : 'var(--border)'}`,
                    boxShadow: isExpanded ? 'var(--shadow-raised)' : 'var(--shadow)',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: ph.bg, border: `1px solid ${ph.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: 'var(--text-h)',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </span>
                        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-h)', fontWeight: 600 }}>
                          {step.title}
                        </h3>
                      </div>

                      {(step.tips || step.branches) && (
                        <svg
                          viewBox="0 0 24 24" width="16" height="16" fill="none"
                          stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            flexShrink: 0, marginLeft: 8
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </div>

                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
                      {step.desc}
                    </p>

                    {/* Branches (ramificações) */}
                    {step.branches && isExpanded && (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12
                      }}>
                        {step.branches.map((b, bIdx) => (
                          <span key={bIdx} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, fontWeight: 600, padding: '5px 12px',
                            borderRadius: 8,
                            background: `${b.color}14`, border: `1px solid ${b.color}40`,
                            color: 'var(--text-h)'
                          }}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: b.color, flexShrink: 0
                            }} />
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dicas expandidas */}
                    {step.tips && isExpanded && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px',
                        background: 'var(--accent-bg)', borderRadius: 8,
                        border: '1px solid var(--accent-border)',
                        fontSize: 12, color: 'var(--text)'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          💡 Dicas
                        </div>
                        {step.tips.map((tip, tIdx) => (
                          <div key={tIdx} style={{ display: 'flex', gap: 6, marginBottom: tIdx < step.tips!.length - 1 ? 4 : 0 }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>•</span>
                            {tip}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rodapé resumo */}
      <div className="panel" style={{
        marginTop: 32, padding: '18px 22px',
        background: 'var(--panel)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 14
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', marginBottom: 2 }}>
            Resumo do processo
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            {steps.length} etapas · {Object.keys(PHASE_META).length} fases · Peças de diferentes apartamentos são lavadas
            juntas quando possuem o mesmo tipo e grau de sujidade.
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
