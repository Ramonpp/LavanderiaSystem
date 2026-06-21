import { useState } from 'react'

const stainData = [
  {
    color: '#E8A030',
    colorName: 'Amarela / Alaranjada',
    dot: 'linear-gradient(135deg, #E8A030, #D4782F)',
    causes: [
      { name: 'Protetor solar', detail: 'Avobenzona + ferro da água = oxidação alaranjada' },
      { name: 'Suor / sebo corporal', detail: 'Oleosidade + suor acumulado no travesseiro e lençol' },
      { name: 'Desodorante', detail: 'Alumínio do antitranspirante reage com suor' },
      { name: 'Autobronzeador / bronzeador', detail: 'DHA (di-hidroxiacetona) pigmenta o tecido' },
    ],
    steps: [
      { produto: 'Solvfresh', acao: 'Pingar direto na mancha seca, esfregar leve com escova macia', tempo: '10–15 min' },
      { produto: 'Azulim Tira Ferrugem', acao: 'Gotas sobre o tom alaranjado que restou (se houver)', tempo: '5 min, enxaguar bem' },
      { produto: 'Alvfresh ou Percarbonato', acao: 'Molho em água quente 50–60 °C na máquina', tempo: '30–40 min' },
    ],
    tip: 'Nunca seque antes de tratar. Calor fixa a oxidação de vez.',
  },
  {
    color: '#D9587B',
    colorName: 'Rosa / Avermelhada',
    dot: 'linear-gradient(135deg, #D9587B, #C24466)',
    causes: [
      { name: 'Protetor solar + ferro', detail: 'Variação rosada da mesma reação da avobenzona' },
      { name: 'Batom / blush / base', detail: 'Pigmento cosmético à base de óxido de ferro' },
      { name: 'Vinho tinto / suco de uva', detail: 'Antocianina — pigmento vegetal intenso' },
      { name: 'Bactéria Serratia marcescens', detail: 'Biofilme rosa em peça guardada úmida/dobrada' },
      { name: 'Sangue mal lavado', detail: 'Hemoglobina oxidada fica rosada/marrom' },
    ],
    steps: [
      { produto: 'Solvfresh', acao: 'Se houver componente oleoso (cosmético), tratar primeiro', tempo: '10 min' },
      { produto: 'Azulim Tira Ferrugem', acao: 'Para tom rosado de ferro/protetor — gotas localizadas', tempo: '5 min, enxaguar' },
      { produto: 'Percarbonato', acao: 'Molho em água quente para pigmento vegetal ou sangue', tempo: '30–60 min' },
    ],
    tip: 'Se a mancha rosa vem de peça guardada úmida, é bactéria. Trate com percarbonato quente e nunca guarde úmido.',
  },
  {
    color: '#8B6914',
    colorName: 'Marrom / Encardida',
    dot: 'linear-gradient(135deg, #8B6914, #6B4F10)',
    causes: [
      { name: 'Café / chá', detail: 'Taninos — pigmento vegetal escuro' },
      { name: 'Chocolate / açaí', detail: 'Gordura + pigmento vegetal combinados' },
      { name: 'Fezes / vômito', detail: 'Proteína + pigmento orgânico' },
      { name: 'Terra / barro', detail: 'Partícula mineral impregnada' },
      { name: 'Encardido geral', detail: 'Acúmulo de suor, poeira e sabão mal enxaguado' },
    ],
    steps: [
      { produto: 'Sabão de coco', acao: 'Esfregar ponto a ponto com escova macia, pré-tratar', tempo: '5–10 min' },
      { produto: 'Solvfresh', acao: 'Se tiver gordura (chocolate, açaí), aplicar direto', tempo: '10 min' },
      { produto: 'Alvfresh', acao: 'Molho em água quente — o peróxido quebra tanino', tempo: '30–40 min' },
    ],
    tip: 'Para fezes/vômito: enxágue frio primeiro (proteína coagula no calor), depois siga a sequência.',
  },
  {
    color: '#4A4A4A',
    colorName: 'Cinza / Preta',
    dot: 'linear-gradient(135deg, #5A5A5A, #333)',
    causes: [
      { name: 'Maquiagem escura (rímel, delineador)', detail: 'Cera + pigmento preto de carbono' },
      { name: 'Graxa / óleo mecânico', detail: 'Hidrocarboneto pesado' },
      { name: 'Mofo seco', detail: 'Fungo morto — mancha residual acinzentada' },
      { name: 'Transferência de jeans', detail: 'Índigo transferido no contato ou na lavagem' },
      { name: 'Encardido de sabão + dureza', detail: 'Residual de sabão em barra com cálcio da água' },
    ],
    steps: [
      { produto: 'Solvfresh', acao: 'Direto na mancha — dissolve cera, graxa e pigmento oleoso', tempo: '15 min' },
      { produto: 'Sabão de coco', acao: 'Reforçar esfregação local se persistir', tempo: '5 min' },
      { produto: 'Percarbonato', acao: 'Molho quente para clarear o residual', tempo: '40–60 min' },
    ],
    tip: 'Mofo: além de tirar a mancha, seque ao sol. Sol mata esporo. Revise o local de armazenamento.',
  },
  {
    color: '#C4A82F',
    colorName: 'Amarela clara / Esverdeada',
    dot: 'linear-gradient(135deg, #C4A82F, #8B9A2F)',
    causes: [
      { name: 'Urina', detail: 'Ureia + ácido úrico — amarelado, cheiro forte' },
      { name: 'Repelente de insetos', detail: 'DEET e óleos mancham e amarelam' },
      { name: 'Cloro da piscina + protetor', detail: 'Reação química dupla — amarelado/esverdeado' },
      { name: 'Grama / folha', detail: 'Clorofila — pigmento vegetal verde' },
    ],
    steps: [
      { produto: 'Solvfresh', acao: 'Para repelente e componente oleoso', tempo: '10 min' },
      { produto: 'Percarbonato', acao: 'Molho morno a quente — quebra urina e clorofila', tempo: '30 min' },
      { produto: 'Alvfresh', acao: 'Reforço final em água quente se a mancha persistir', tempo: '20–30 min' },
    ],
    tip: 'Urina: enxágue frio antes. Água quente direto fixa o cheiro.',
  },
  {
    color: '#7B3F00',
    colorName: 'Ferrugem / Ocre',
    dot: 'linear-gradient(135deg, #B85C1E, #7B3F00)',
    causes: [
      { name: 'Água com ferro (poço/caixa velha)', detail: 'Ferro dissolvido precipita e mancha tudo' },
      { name: 'Varal/cabide/mola enferrujada', detail: 'Contato direto com metal oxidado' },
      { name: 'Botão/zíper de outra peça', detail: 'Transferência de ferrugem na lavagem' },
    ],
    steps: [
      { produto: 'Azulim Tira Ferrugem', acao: 'Gotas direto na mancha — é o produto-chave aqui', tempo: '5 min, enxaguar muito bem' },
      { produto: 'Alvfresh', acao: 'Se restar sombra, molho em água quente', tempo: '20–30 min' },
    ],
    tip: 'NUNCA use alvejante antes do ácido em ferrugem. O oxidante fixa o óxido de ferro de vez.',
  },
]

const procedureSteps = [
  {
    num: 1,
    title: 'Triagem a seco',
    desc: 'Separe as peças. Identifique e marque cada mancha antes de molhar. Agrupe: oleosas (protetor, maquiagem), proteicas (sangue, vômito), pigmento (café, vinho) e ferrugem.',
    machine: false,
  },
  {
    num: 2,
    title: 'Spotting — Desengordure',
    desc: 'Solvfresh ou sabão de coco direto na mancha seca. Escova macia, movimentos circulares. Deixe 10–15 min. Enxágue morno.',
    machine: false,
    dosagem: 'Solvfresh puro na mancha',
  },
  {
    num: 3,
    title: 'Spotting — Ácido (se houver tom laranja/rosa/ferrugem)',
    desc: 'Azulim Tira Ferrugem em gotas sobre o ponto. Máximo 5 min. Enxágue abundante com água fria. Use luvas!',
    machine: false,
    dosagem: 'Gotas localizadas — nunca em molho',
    warning: 'Nunca misture com Alvfresh ou percarbonato no mesmo passo.',
  },
  {
    num: 4,
    title: 'Lavagem principal na máquina',
    desc: 'Carga de até 10–11 kg (80% da capacidade). Ciclo pesado/algodão, água quente. Use detergente de lavanderia.',
    machine: true,
    dosagem: 'Detergente conforme rótulo (~30–50 mL p/ 10 kg)',
  },
  {
    num: 5,
    title: 'Alvejamento com oxigênio',
    desc: 'Adicione Alvfresh ou percarbonato na mesma lavagem (compartimento de alvejante) ou em molho separado. Água 50–60 °C, mínimo 20–30 min de contato.',
    machine: true,
    dosagem: 'Alvfresh: 70–150 mL por carga (7–15 mL/kg) · Percarbonato: 50–100 g por carga',
  },
  {
    num: 6,
    title: 'Enxágue final + neutralização',
    desc: 'Último enxágue: adicione neutralizante ácido (sour) ou 50 mL de vinagre branco. Baixa o pH, protege a fibra, mantém o branco vivo.',
    machine: true,
    dosagem: 'Vinagre branco: ~50 mL no último enxágue',
  },
  {
    num: 7,
    title: 'Conferência antes de secar',
    desc: 'Tire da máquina e confira cada peça sob boa luz. Mancha visível? Volte ao passo 2. Só seque/passe depois de aprovada.',
    machine: false,
    warning: 'Calor (secadora, ferro, sol) fixa mancha não tratada permanentemente.',
  },
]

const produtos = [
  {
    nome: 'Solvfresh (Spartan)',
    tipo: 'Desengordurante solvente',
    cor: '#E67E22',
    funcao: 'Dissolve óleo, graxa, batom, protetor solar, cera. Sempre o 1º passo em mancha oleosa.',
    dose: 'Puro na mancha (spotting) ou 5–10 mL/kg na máquina para carga oleosa',
    regra: 'Pode ser usado junto com detergente na máquina. Não misture com Azulim.',
  },
  {
    nome: 'Azulim Tira Ferrugem',
    tipo: 'Ácido oxálico — removedor de ferro',
    cor: '#C0392B',
    funcao: 'Dissolve óxido de ferro, ferrugem, tom alaranjado/rosado de protetor solar.',
    dose: 'Gotas localizadas, máx. 5 min. Sempre enxaguar muito bem depois.',
    regra: 'NUNCA no mesmo banho que Alvfresh ou percarbonato. NUNCA sem luvas. Só spotting localizado.',
  },
  {
    nome: 'Alvfresh (Spartan)',
    tipo: 'Alvejante — peróxido de hidrogênio líquido',
    cor: '#2980B9',
    funcao: 'Alveja e remove pigmento: café, chá, vinho, sangue, suor. Seguro para branco e colorido.',
    dose: '70–150 mL por carga (7–15 mL/kg) · Água 50–60 °C · 20–40 min de contato',
    regra: 'Compartimento de alvejante da máquina. Não misture com Azulim. Rendimento melhor em água quente.',
  },
  {
    nome: 'Percarbonato de sódio',
    tipo: 'Alvejante oxigenado em pó (booster)',
    cor: '#8E44AD',
    funcao: 'Mesmo princípio do Alvfresh, porém em pó e mais alcalino. Bom para molhos prolongados.',
    dose: '50–100 g por carga · Só funciona acima de 40 °C — ideal 50–60 °C',
    regra: 'Alternativa ao Alvfresh ou reforço. Dissolver na água antes de colocar a roupa. Não misture com ácido.',
  },
  {
    nome: 'Sabão de coco',
    tipo: 'Sabão alcalino natural',
    cor: '#27AE60',
    funcao: 'Pré-tratamento manual em bancada. Bom para esfregar pontos localizados.',
    dose: 'Direto na mancha com escova macia',
    regra: 'Evite como detergente principal na máquina — em água dura forma resíduo que acinzenta o branco.',
  },
]

type View = 'manchas' | 'procedimento' | 'produtos'

export function ManchasPage() {
  const [activeStain, setActiveStain] = useState(0)
  const [view, setView] = useState<View>('manchas')

  const tabs: { id: View; label: string }[] = [
    { id: 'manchas', label: 'Por Cor da Mancha' },
    { id: 'procedimento', label: 'Procedimento Completo' },
    { id: 'produtos', label: 'Meus Produtos' },
  ]

  return (
    <div style={{ padding: '24px 16px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 6,
        }}>
          Guia de Referência — Lavanderia Enxoval Airbnb
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2, color: 'var(--text)' }}>
          Identificação e Tratamento de Manchas
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>
          Máquinas LG VC4 14 kg · Água de rede · Enxoval branco
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: 24,
        borderBottom: '2px solid var(--border)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: view === tab.id ? 700 : 500,
              background: 'none',
              border: 'none',
              borderBottom: view === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              color: view === tab.id ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MANCHAS VIEW */}
      {view === 'manchas' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {stainData.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveStain(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: activeStain === i
                    ? `2px solid ${s.color}`
                    : '2px solid var(--border)',
                  background: activeStain === i
                    ? `${s.color}18`
                    : 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontSize: 12,
                  fontWeight: activeStain === i ? 700 : 500,
                  color: 'var(--text)',
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: s.dot,
                  flexShrink: 0,
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                }} />
                {s.colorName.split(' / ')[0]}
              </button>
            ))}
          </div>

          {(() => {
            const s = stainData[activeStain]
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: s.dot,
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)',
                    flexShrink: 0,
                  }} />
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    {s.colorName}
                  </h2>
                </div>

                {/* Causas */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--muted)',
                    marginBottom: 10,
                    fontWeight: 600,
                  }}>
                    O que causa essa mancha
                  </div>
                  {s.causes.map((c, j) => (
                    <div key={j} style={{
                      padding: '8px 0',
                      borderBottom: j < s.causes.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.detail}</div>
                    </div>
                  ))}
                </div>

                {/* Passos */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--muted)',
                    marginBottom: 10,
                    fontWeight: 600,
                  }}>
                    Sequência de tratamento
                  </div>
                  {s.steps.map((step, j) => (
                    <div key={j} style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: j < s.steps.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: s.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 2,
                      }}>
                        {j + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{step.produto}</div>
                        <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{step.acao}</div>
                        <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 4 }}>
                          ⏱ {step.tempo}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dica */}
                <div style={{
                  background: '#FFF8E6',
                  border: '1px solid #F0D86E',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#6B5A00',
                }}>
                  <span style={{ fontWeight: 700 }}>⚠ Atenção: </span>
                  {s.tip}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* PROCEDIMENTO VIEW */}
      {view === 'procedimento' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
            Sequência completa para carga de enxoval branco nas LG VC4 14 kg.
            Carga ideal: 10–11 kg (nunca lotada).
          </p>

          {procedureSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 4, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: step.machine ? '#2563EB' : '#0D9488',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                  {step.num}
                </div>
                {i < procedureSteps.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 20 }} />
                )}
              </div>

              <div style={{ flex: 1, paddingBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: step.machine ? '#EFF6FF' : '#F0FDFA',
                    color: step.machine ? '#2563EB' : '#0D9488',
                    fontWeight: 600,
                  }}>
                    {step.machine ? 'MÁQUINA' : 'BANCADA'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{step.desc}</div>
                {step.dosagem && (
                  <div style={{
                    fontSize: 12,
                    color: '#2563EB',
                    fontWeight: 600,
                    marginTop: 6,
                    background: '#EFF6FF',
                    padding: '6px 10px',
                    borderRadius: 6,
                    display: 'inline-block',
                  }}>
                    Dosagem: {step.dosagem}
                  </div>
                )}
                {step.warning && (
                  <div style={{
                    fontSize: 12,
                    color: '#92400E',
                    fontWeight: 500,
                    marginTop: 6,
                    background: '#FFF8E6',
                    padding: '6px 10px',
                    borderRadius: 6,
                  }}>
                    ⚠ {step.warning}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRODUTOS VIEW */}
      {view === 'produtos' && (
        <div>
          {produtos.map((p, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 12,
              borderLeft: `4px solid ${p.cor}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, color: 'var(--text)' }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: p.cor, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p.tipo}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 6, color: 'var(--text)' }}>
                <span style={{ fontWeight: 600 }}>Função: </span>{p.funcao}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 6, color: 'var(--text)' }}>
                <span style={{ fontWeight: 600 }}>Dosagem: </span>{p.dose}
              </div>
              <div style={{
                fontSize: 12,
                background: '#FFF8E6',
                padding: '6px 10px',
                borderRadius: 6,
                color: '#6B5A00',
                lineHeight: 1.5,
              }}>
                <span style={{ fontWeight: 700 }}>Regra: </span>{p.regra}
              </div>
            </div>
          ))}

          <div style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 10,
            padding: 16,
            marginTop: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E40AF', marginBottom: 8 }}>
              O que ainda falta no seu kit
            </div>
            {[
              { nome: 'Detergente enzimático de lavanderia', pq: 'Protease + lipase — ataca suor, sangue, sebo, comida. É o que mais faz diferença no dia a dia de enxoval.' },
              { nome: 'Neutralizante ácido (sour) de lavanderia', pq: 'Último enxágue — baixa pH, preserva fibra, mantém alvura. Substituto caseiro: vinagre branco.' },
              { nome: 'Sequestrante / abrandador de água', pq: 'Previne mancha de ferro e dureza na própria máquina. Reduz muito o retrabalho com Azulim.' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '8px 0',
                borderBottom: i < 2 ? '1px solid #DBEAFE' : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>{item.nome}</div>
                <div style={{ fontSize: 12, color: '#3B5998', marginTop: 2 }}>{item.pq}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: 32,
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--muted)',
        textAlign: 'center',
      }}>
        Regra de ouro: ÓLEO → FERRO → PIGMENTO → NEUTRALIZAR · Nunca seque antes de conferir
      </div>
    </div>
  )
}
