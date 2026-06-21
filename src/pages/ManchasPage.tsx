import { useState } from 'react'

/* ── Dados ──────────────────────────────────────────────── */
const stainData = [
  {
    color: '#E8A030',
    colorName: 'Amarela / Alaranjada',
    gradient: 'linear-gradient(135deg, #E8A030, #D4782F)',
    causas: [
      { nome: 'Protetor solar', detalhe: 'Avobenzona + ferro da água → oxidação alaranjada' },
      { nome: 'Suor / sebo', detalhe: 'Oleosidade acumulada no travesseiro e lençol' },
      { nome: 'Desodorante', detalhe: 'Alumínio do antitranspirante reage com suor' },
      { nome: 'Autobronzeador', detalhe: 'DHA pigmenta o tecido permanentemente se fixar' },
    ],
    passos: [
      { produto: 'Solvfresh', acao: 'Pingar direto na mancha seca, esfregar com escova macia', tempo: '10–15 min' },
      { produto: 'Azulim Tira Ferrugem', acao: 'Gotas sobre o tom alaranjado restante (se houver)', tempo: '5 min + enxaguar bem' },
      { produto: 'Alvfresh ou Percarbonato', acao: 'Molho em água quente 50–60 °C na máquina', tempo: '30–40 min' },
    ],
    atencao: 'Nunca seque antes de tratar. Calor fixa a oxidação de vez.',
  },
  {
    color: '#D9587B',
    colorName: 'Rosa / Avermelhada',
    gradient: 'linear-gradient(135deg, #D9587B, #C24466)',
    causas: [
      { nome: 'Protetor solar + ferro', detalhe: 'Variação rosada da mesma reação da avobenzona' },
      { nome: 'Batom / blush / base', detalhe: 'Pigmento cosmético à base de óxido de ferro' },
      { nome: 'Vinho tinto / suco de uva', detalhe: 'Antocianina — pigmento vegetal intenso' },
      { nome: 'Bactéria (Serratia)', detalhe: 'Biofilme rosa em peça guardada úmida ou dobrada' },
      { nome: 'Sangue mal lavado', detalhe: 'Hemoglobina oxidada fica rosada/marrom' },
    ],
    passos: [
      { produto: 'Solvfresh', acao: 'Se houver componente oleoso (cosmético), tratar primeiro', tempo: '10 min' },
      { produto: 'Azulim Tira Ferrugem', acao: 'Para tom rosado de ferro/protetor — gotas localizadas', tempo: '5 min + enxaguar' },
      { produto: 'Percarbonato', acao: 'Molho em água quente para pigmento vegetal ou sangue', tempo: '30–60 min' },
    ],
    atencao: 'Mancha rosa em peça que ficou úmida = bactéria. Trate com percarbonato quente e nunca guarde úmido.',
  },
  {
    color: '#7B5A14',
    colorName: 'Marrom / Encardida',
    gradient: 'linear-gradient(135deg, #8B6914, #6B4F10)',
    causas: [
      { nome: 'Café / chá', detalhe: 'Taninos — pigmento vegetal escuro e penetrante' },
      { nome: 'Chocolate / açaí', detalhe: 'Gordura + pigmento vegetal combinados' },
      { nome: 'Fezes / vômito', detalhe: 'Proteína + pigmento orgânico — enxágue frio primeiro' },
      { nome: 'Terra / barro', detalhe: 'Partícula mineral impregnada na fibra' },
      { nome: 'Encardido geral', detalhe: 'Acúmulo de suor, poeira e sabão mal enxaguado' },
    ],
    passos: [
      { produto: 'Sabão de coco', acao: 'Esfregar ponto a ponto com escova macia, pré-tratar', tempo: '5–10 min' },
      { produto: 'Solvfresh', acao: 'Se tiver gordura (chocolate, açaí), aplicar direto', tempo: '10 min' },
      { produto: 'Alvfresh', acao: 'Molho em água quente — o peróxido quebra o tanino', tempo: '30–40 min' },
    ],
    atencao: 'Fezes/vômito: enxágue FRIO primeiro (proteína coagula no calor). Só depois aplique os produtos.',
  },
  {
    color: '#4A4A4A',
    colorName: 'Cinza / Preta',
    gradient: 'linear-gradient(135deg, #5A5A5A, #333)',
    causas: [
      { nome: 'Rímel / delineador', detalhe: 'Cera + pigmento preto de carbono' },
      { nome: 'Graxa / óleo mecânico', detalhe: 'Hidrocarboneto pesado — precisa de solvente' },
      { nome: 'Mofo seco', detalhe: 'Fungo morto — mancha residual acinzentada' },
      { nome: 'Transferência de jeans', detalhe: 'Índigo transferido no contato ou na lavagem' },
    ],
    passos: [
      { produto: 'Solvfresh', acao: 'Direto na mancha — dissolve cera, graxa e pigmento oleoso', tempo: '15 min' },
      { produto: 'Sabão de coco', acao: 'Reforçar esfregação local se persistir', tempo: '5 min' },
      { produto: 'Percarbonato', acao: 'Molho quente para clarear o residual', tempo: '40–60 min' },
    ],
    atencao: 'Mofo: além de tirar a mancha, seque ao sol — o UV mata esporos. Revise onde a peça fica armazenada.',
  },
  {
    color: '#8B9A10',
    colorName: 'Amarelo-esverdeada',
    gradient: 'linear-gradient(135deg, #C4A82F, #8B9A2F)',
    causas: [
      { nome: 'Urina', detalhe: 'Ureia + ácido úrico — amarelado, cheiro forte' },
      { nome: 'Repelente de insetos', detalhe: 'DEET e óleos mancham e amarelam o tecido' },
      { nome: 'Cloro de piscina + protetor', detalhe: 'Reação química dupla — amarelado/esverdeado' },
      { nome: 'Grama / folha', detalhe: 'Clorofila — pigmento vegetal verde' },
    ],
    passos: [
      { produto: 'Solvfresh', acao: 'Para repelente e qualquer componente oleoso', tempo: '10 min' },
      { produto: 'Percarbonato', acao: 'Molho morno a quente — quebra urina e clorofila', tempo: '30 min' },
      { produto: 'Alvfresh', acao: 'Reforço final em água quente se a mancha persistir', tempo: '20–30 min' },
    ],
    atencao: 'Urina: enxágue com água FRIA antes. Água quente direto fixa o cheiro na fibra.',
  },
  {
    color: '#7B3F00',
    colorName: 'Ferrugem / Ocre',
    gradient: 'linear-gradient(135deg, #B85C1E, #7B3F00)',
    causas: [
      { nome: 'Água com ferro', detalhe: 'Ferro dissolvido precipita e mancha tudo durante a lavagem' },
      { nome: 'Varal / cabide enferrujado', detalhe: 'Contato direto com metal oxidado' },
      { nome: 'Botão / zíper de outra peça', detalhe: 'Transferência de ferrugem dentro da máquina' },
    ],
    passos: [
      { produto: 'Azulim Tira Ferrugem', acao: 'Gotas direto na mancha — único produto que resolve', tempo: '5 min + enxaguar muito bem' },
      { produto: 'Alvfresh', acao: 'Se restar sombra, molho em água quente', tempo: '20–30 min' },
    ],
    atencao: 'NUNCA use alvejante ANTES do ácido em ferrugem. O oxidante fixa o óxido de ferro de vez.',
  },
]

const procedimento = [
  { num: 1, local: false, titulo: 'Triagem a seco', desc: 'Separe as peças manchadas antes de molhar. Marque cada mancha com grampo ou fita. Agrupe: oleosas (protetor, maquiagem), proteicas (sangue, vômito), pigmento (café, vinho) e ferrugem.', dosagem: null, alerta: null },
  { num: 2, local: false, titulo: 'Spotting — Desengordure', desc: 'Solvfresh ou sabão de coco direto na mancha seca. Escova macia em movimentos circulares. Deixe agir e enxágue morno.', dosagem: 'Solvfresh puro direto na mancha', alerta: null },
  { num: 3, local: false, titulo: 'Spotting — Ácido (se tom laranja, rosa ou ferrugem)', desc: 'Azulim Tira Ferrugem em gotas apenas sobre o ponto manchado. Máximo 5 min. Enxágue com água fria em abundância. Use luvas!', dosagem: 'Gotas localizadas — nunca em molho', alerta: 'Nunca misture com Alvfresh ou percarbonato no mesmo passo.' },
  { num: 4, local: true,  titulo: 'Lavagem principal', desc: 'Carga de até 10–11 kg (80% da capacidade). Ciclo pesado / algodão, água quente. Use detergente de lavanderia.', dosagem: 'Detergente conforme rótulo (~30–50 mL p/ 10 kg)', alerta: null },
  { num: 5, local: true,  titulo: 'Alvejamento com oxigênio', desc: 'Adicione Alvfresh ou percarbonato no compartimento de alvejante ou em molho separado. Água 50–60 °C, mínimo 20–30 min de contato.', dosagem: 'Alvfresh: 70–150 mL / carga · Percarbonato: 50–100 g / carga', alerta: null },
  { num: 6, local: true,  titulo: 'Enxágue final + neutralização', desc: 'Último enxágue com 50 mL de vinagre branco ou neutralizante ácido (sour). Baixa o pH, protege a fibra e mantém o branco vivo.', dosagem: 'Vinagre branco: ~50 mL no último enxágue', alerta: null },
  { num: 7, local: false, titulo: 'Conferência antes de secar', desc: 'Retire da máquina e confira cada peça sob boa luz. Mancha visível? Volte ao passo 2. Só seque ou passe depois de aprovada.', dosagem: null, alerta: 'Calor (secadora, ferro, sol) fixa mancha não tratada permanentemente.' },
]

const produtos = [
  {
    nome: 'Solvfresh',
    fabricante: 'Spartan',
    tipo: 'Desengordurante solvente',
    cor: '#E67E22',
    funcao: 'Dissolve óleo, graxa, batom, protetor solar e cera. Sempre o 1º passo em mancha oleosa.',
    dose: 'Puro na mancha (spotting) ou 5–10 mL/kg na máquina para carga oleosa',
    regra: 'Pode ir junto com detergente na máquina. Não misture com Azulim.',
    usarEm: ['Amarela', 'Rosa', 'Marrom', 'Cinza', 'Esverdeada'],
  },
  {
    nome: 'Azulim Tira Ferrugem',
    fabricante: '',
    tipo: 'Ácido oxálico',
    cor: '#C0392B',
    funcao: 'Dissolve óxido de ferro, ferrugem e tom alaranjado/rosado de protetor solar.',
    dose: 'Gotas localizadas, máx. 5 min. Enxaguar muito bem depois.',
    regra: 'NUNCA no mesmo banho que Alvfresh ou percarbonato. NUNCA sem luvas.',
    usarEm: ['Amarela', 'Rosa', 'Ferrugem'],
  },
  {
    nome: 'Alvfresh',
    fabricante: 'Spartan',
    tipo: 'Alvejante — peróxido líquido',
    cor: '#2980B9',
    funcao: 'Alveja e remove pigmento: café, chá, vinho, sangue, suor. Seguro para branco e colorido.',
    dose: '70–150 mL / carga (7–15 mL/kg) · Água 50–60 °C · 20–40 min de contato',
    regra: 'Use no compartimento de alvejante. Rendimento melhor em água quente.',
    usarEm: ['Amarela', 'Rosa', 'Marrom', 'Esverdeada', 'Ferrugem'],
  },
  {
    nome: 'Percarbonato de sódio',
    fabricante: 'Genérico',
    tipo: 'Alvejante em pó (booster)',
    cor: '#8E44AD',
    funcao: 'Mesmo princípio do Alvfresh, em pó e mais alcalino. Ideal para molhos prolongados.',
    dose: '50–100 g / carga · Só funciona acima de 40 °C — ideal 50–60 °C',
    regra: 'Dissolva na água antes de colocar a roupa. Não misture com ácido (Azulim).',
    usarEm: ['Rosa', 'Marrom', 'Cinza', 'Esverdeada'],
  },
  {
    nome: 'Sabão de coco',
    fabricante: '',
    tipo: 'Sabão alcalino natural',
    cor: '#27AE60',
    funcao: 'Pré-tratamento manual em bancada. Bom para esfregar pontos localizados.',
    dose: 'Direto na mancha com escova macia',
    regra: 'Evite como detergente principal na máquina — em água dura forma resíduo que acinzenta o branco.',
    usarEm: ['Marrom', 'Cinza'],
  },
]

type View = 'manchas' | 'procedimento' | 'produtos'

/* ── Componente ─────────────────────────────────────────── */
export function ManchasPage() {
  const [view, setView] = useState<View>('manchas')
  const [stainIdx, setStainIdx] = useState(0)

  const stain = stainData[stainIdx]

  const TABS: { id: View; label: string }[] = [
    { id: 'manchas',      label: 'Por cor da mancha'    },
    { id: 'procedimento', label: 'Procedimento completo' },
    { id: 'produtos',     label: 'Produtos'              },
  ]

  return (
    <div className="grid" style={{ gap: 16 }}>

      {/* ── Cabeçalho ── */}
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.3 }}>Guia de Manchas</h1>
        <p className="hint" style={{ marginTop: 4 }}>
          Enxoval branco · Máquinas LG VC4 14 kg · Identifique a cor e siga a sequência de tratamento
        </p>
      </header>

      {/* ── Regra de ouro ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--radius)',
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--accent)',
        flexWrap: 'wrap',
      }}>
        <span>Regra de ouro:</span>
        {['ÓLEO', '→', 'FERRO', '→', 'PIGMENTO', '→', 'NEUTRALIZAR'].map((t, i) => (
          t === '→'
            ? <span key={i} style={{ opacity: 0.5, fontWeight: 400 }}>→</span>
            : <span key={i} className="badge badgeBlue" style={{ fontSize: 11 }}>{t}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>
          Nunca seque antes de conferir
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '4px',
        background: 'var(--code-bg)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={view === tab.id ? 'btn btnPrimary' : 'btn'}
            style={{
              flex: 1,
              fontSize: 13,
              padding: '8px 10px',
              minHeight: 36,
              boxShadow: view === tab.id ? undefined : 'none',
              border: 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          VIEW: POR COR DA MANCHA
      ════════════════════════════════════════════ */}
      {view === 'manchas' && (
        <>
          {/* Seletor de cor */}
          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 15 }}>Qual é a cor da mancha?</h2>
            </div>
            <div className="panelBody">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {stainData.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStainIdx(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 14px',
                      borderRadius: 'var(--radius)',
                      border: stainIdx === i ? `2px solid ${s.color}` : '2px solid var(--border)',
                      background: stainIdx === i ? `${s.color}15` : 'var(--panel)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: stainIdx === i ? 700 : 500,
                      color: 'var(--text-h)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: s.gradient,
                      flexShrink: 0,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
                    }} />
                    {s.colorName.split(' / ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Banner da mancha selecionada */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            background: stain.gradient,
            color: '#fff',
          }}>
            <span style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid rgba(255,255,255,0.5)',
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{stain.colorName}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {stain.causas.length} causas conhecidas · {stain.passos.length} passos de tratamento
              </div>
            </div>
          </div>

          <div className="grid gridCols2">
            {/* Causas */}
            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 14 }}>Possíveis causas</h2>
              </div>
              <div className="panelBody" style={{ padding: 0 }}>
                {stain.causas.map((c, i) => (
                  <div key={i} style={{
                    padding: '10px 16px',
                    borderBottom: i < stain.causas.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>{c.nome}</span>
                    <span className="hint">{c.detalhe}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Passos */}
            <div className="grid" style={{ gap: 8, alignContent: 'start' }}>
              {stain.passos.map((p, i) => (
                <section key={i} className="panel" style={{ borderLeft: `4px solid ${stain.color}` }}>
                  <div className="panelBody" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: stain.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-h)' }}>{p.produto}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{p.acao}</p>
                    <div style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: stain.color,
                      background: `${stain.color}15`,
                      padding: '3px 10px',
                      borderRadius: 20,
                    }}>
                      ⏱ {p.tempo}
                    </div>
                  </div>
                </section>
              ))}

              {/* Atenção */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                background: 'color-mix(in srgb, var(--warning), transparent 88%)',
                border: '1px solid color-mix(in srgb, var(--warning), transparent 60%)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text-h)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>⚠ Atenção: </span>
                {stain.atencao}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          VIEW: PROCEDIMENTO COMPLETO
      ════════════════════════════════════════════ */}
      {view === 'procedimento' && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Sequência completa de lavagem</h2>
            <span className="hint" style={{ fontSize: 12 }}>LG VC4 14 kg · carga ideal 10–11 kg</span>
          </div>
          <div className="panelBody" style={{ padding: 0 }}>
            {procedimento.map((step, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 0,
                borderBottom: i < procedimento.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Número + linha */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 52,
                  flexShrink: 0,
                  padding: '16px 0',
                }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: step.local ? 'var(--accent)' : 'var(--ok)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {step.num}
                  </div>
                  {i < procedimento.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 6, minHeight: 16 }} />
                  )}
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, padding: '16px 16px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)' }}>{step.titulo}</span>
                    <span className={`badge ${step.local ? 'badgeBlue' : 'badgeGreen'}`} style={{ fontSize: 10 }}>
                      {step.local ? 'MÁQUINA' : 'BANCADA'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{step.desc}</p>

                  {step.dosagem && (
                    <div style={{
                      display: 'inline-block',
                      marginTop: 8,
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--code-bg)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-h)',
                    }}>
                      Dosagem: {step.dosagem}
                    </div>
                  )}

                  {step.alerta && (
                    <div style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'color-mix(in srgb, var(--warning), transparent 88%)',
                      border: '1px solid color-mix(in srgb, var(--warning), transparent 60%)',
                      fontSize: 12,
                      color: 'var(--text-h)',
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--warning)' }}>⚠ </span>{step.alerta}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          VIEW: PRODUTOS
      ════════════════════════════════════════════ */}
      {view === 'produtos' && (
        <>
          {produtos.map((p, i) => (
            <section key={i} className="panel" style={{ borderLeft: `4px solid ${p.cor}` }}>
              <div className="panelHeader">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-h)' }}>
                    {p.nome}
                    {p.fabricante && <span className="hint" style={{ fontSize: 12, marginLeft: 8, fontWeight: 400 }}>({p.fabricante})</span>}
                  </div>
                  <span className="badge badgeMuted" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>{p.tipo}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                  {p.usarEm.map((u) => (
                    <span key={u} className="badge" style={{ fontSize: 10, background: `${p.cor}15`, color: p.cor, borderColor: `${p.cor}40` }}>
                      {u}
                    </span>
                  ))}
                </div>
              </div>
              <div className="panelBody grid" style={{ gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--code-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div className="statLabel" style={{ marginBottom: 4 }}>Função</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{p.funcao}</p>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--code-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div className="statLabel" style={{ marginBottom: 4 }}>Dosagem</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{p.dose}</p>
                  </div>
                </div>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'color-mix(in srgb, var(--warning), transparent 88%)',
                  border: '1px solid color-mix(in srgb, var(--warning), transparent 60%)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-h)',
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--warning)' }}>Regra: </span>{p.regra}
                </div>
              </div>
            </section>
          ))}

          {/* Kit incompleto */}
          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 14 }}>O que ainda falta no kit</h2>
              <span className="badge badgeBlue">Recomendado</span>
            </div>
            <div className="panelBody" style={{ padding: 0 }}>
              {[
                { nome: 'Detergente enzimático de lavanderia', pq: 'Protease + lipase — ataca suor, sangue, sebo e comida. É o que mais faz diferença no dia a dia de enxoval.' },
                { nome: 'Neutralizante ácido (sour)', pq: 'Último enxágue — baixa pH, preserva fibra, mantém alvura. Substituto caseiro: vinagre branco.' },
                { nome: 'Sequestrante / abrandador de água', pq: 'Previne mancha de ferro e dureza na própria máquina. Reduz muito o retrabalho com Azulim.' },
              ].map((item, i, arr) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>{item.nome}</span>
                  <span className="hint">{item.pq}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
