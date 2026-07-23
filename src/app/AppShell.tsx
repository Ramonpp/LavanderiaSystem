import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import styles from './AppShell.module.css'
import { SetupBanner } from '../components/SetupBanner'
import { checkDbHealth, type DbHealth } from '../lib/healthCheck'
import { resolveTheme, toggleTheme, type Theme } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { executarExpurgoAutomatico30Dias } from '../lib/autoPurge'

/* ── SVG icons ─────────────────────────────────────────── */
const Ico = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  pedidos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M21 21v-2a4 4 0 00-3-3.85" />
    </svg>
  ),
  pecas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  despesas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9a2.5 2.5 0 00-5 0v1a2.5 2.5 0 005 0" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="16" x2="14" y2="16" />
    </svg>
  ),
  maquinas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  custos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  relatorios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  simulacao: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
      <circle cx="17" cy="16" r="2.5" />
      <line x1="19" y1="18" x2="21" y2="20" />
    </svg>
  ),
  manchas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="4" />
      <circle cx="16" cy="15" r="3" />
      <circle cx="6" cy="17" r="2" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="11" cy="18" r="2" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
}

/* ── Nav items ─────────────────────────────────────────── */
const navItems = [
  { to: '/dashboard',  icon: Ico.dashboard,  label: 'Dashboard',   desc: 'Resumo do mês'          },
  { to: '/pedidos',    icon: Ico.pedidos,    label: 'Pedidos',     desc: 'Registro e controle'    },
  { to: '/clientes',   icon: Ico.clientes,   label: 'Clientes',    desc: 'Hotéis e contratos'     },
  { to: '/pecas',      icon: Ico.pecas,      label: 'Peças',       desc: 'Tipos de peça'          },
  { to: '/despesas',   icon: Ico.despesas,   label: 'Despesas',    desc: 'Lançamentos mensais'    },
  { to: '/maquinas',   icon: Ico.maquinas,   label: 'Máquinas',    desc: 'Lavagem e secagem'      },
  { to: '/custos',     icon: Ico.custos,     label: 'Custos',      desc: 'Custo por ciclo'        },
  { to: '/relatorios', icon: Ico.relatorios, label: 'Relatórios',  desc: 'Fechamento mensal'      },
  { to: '/simulacao',  icon: Ico.simulacao,  label: 'Simulação',   desc: 'Teste de ganhos'        },
  { to: '/manchas',    icon: Ico.manchas,    label: 'Manchas',     desc: 'Guia de tratamento'     },
  { to: '/configuracoes', icon: Ico.config,  label: 'Config',      desc: 'Webhook e integrações'  },
] as const

/* ── DB status dot ─────────────────────────────────────── */
const DB_DOT: Record<DbHealth, { color: string; label: string }> = {
  checking:       { color: 'var(--muted)',   label: 'Verificando…'    },
  ok:             { color: 'var(--ok)',      label: 'Banco conectado' },
  schema_missing: { color: 'var(--warning)', label: 'Schema pendente' },
  unreachable:    { color: 'var(--danger)',  label: 'Sem conexão'     },
}

const COLLAPSED_KEY = 'lav-sidebar-collapsed'

/* ── Component ─────────────────────────────────────────── */
export function AppShell() {
  const location = useLocation()
  const [health, setHealth] = useState<DbHealth>('checking')
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(resolveTheme)
  const [isPedidosOpen, setIsPedidosOpen] = useState(() => location.pathname.startsWith('/pedidos'))
  const [isDespesasOpen, setIsDespesasOpen] = useState(() => location.pathname.startsWith('/despesas'))
  const [isClientesOpen, setIsClientesOpen] = useState(() => location.pathname.startsWith('/clientes'))
  const [isRelatoriosOpen, setIsRelatoriosOpen] = useState(() => location.pathname.startsWith('/relatorios'))

  useEffect(() => {
    if (location.pathname.startsWith('/pedidos')) {
      setIsPedidosOpen(true)
    }
    if (location.pathname.startsWith('/despesas')) {
      setIsDespesasOpen(true)
    }
    if (location.pathname.startsWith('/clientes')) {
      setIsClientesOpen(true)
    }
    if (location.pathname.startsWith('/relatorios')) {
      setIsRelatoriosOpen(true)
    }
  }, [location.pathname])

  useEffect(() => {
    checkDbHealth().then(setHealth)
    void executarExpurgoAutomatico30Dias()
  }, [])

  function handleToggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  function handleToggleTheme() {
    const next = toggleTheme()
    setTheme(next)
  }

  const dot = DB_DOT[health]
  const sidebarClass = `${styles.sidebar}${isCollapsed ? ` ${styles.collapsed}` : ''}${isMobileOpen ? ` ${styles.sidebarOpen}` : ''}`
  const overlayClass = `${styles.sidebarOverlay}${isMobileOpen ? ` ${styles.sidebarOverlayOpen}` : ''}`

  return (
    <div className={styles.shell}>
      <header className={styles.mobileHeader}>
        <button className={styles.iconBtn} onClick={() => setIsMobileOpen(true)} aria-label="Abrir menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'bold' }}>
          <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6 }} />
        </div>
      </header>

      <div className={overlayClass} onClick={() => setIsMobileOpen(false)} aria-hidden="true" />

      <aside className={sidebarClass} aria-label="Menu lateral">
        {/* Brand */}
        <div className={styles.brand}>
          <img src="/logo.png" alt="Ciclo Novo Logo" className={styles.logoMark} style={{ objectFit: 'contain', width: 36, height: 36, padding: 0, background: 'transparent' }} />
          <div className={styles.brandText}>
            <div className={styles.title}>Ciclo Novo</div>
            <div className={styles.subtitle}>Gestão de lavanderia</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.nav} aria-label="Setores">
          {navItems.map((item) => {
            const isPedidos = item.to === '/pedidos'

            if (isPedidos) {
              return (
                <div key={item.to} className={styles.navGroup}>
                  <div
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false)
                        setIsPedidosOpen(true)
                      } else {
                        setIsPedidosOpen(!isPedidosOpen)
                      }
                    }}
                    className={styles.navItem}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className={styles.navLabel}>
                      <span className={styles.navItemTitle}>{item.label}</span>
                      <span className={styles.navItemDesc}>{item.desc}</span>
                    </span>
                    {!isCollapsed && (
                      <span className={`${styles.chevron} ${isPedidosOpen ? styles.chevronOpen : ''}`}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    )}
                  </div>
                  
                  <div className={`${styles.subMenu} ${isPedidosOpen ? styles.subMenuOpen : styles.subMenuClosed}`}>
                    <NavLink
                      to="/pedidos/criar"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Criar pedido
                    </NavLink>
                    <NavLink
                      to="/pedidos/em-lavagem"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Em lavagem
                    </NavLink>
                    <NavLink
                      to="/pedidos/lista"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Pedidos cadastrados
                    </NavLink>
                    <NavLink
                      to="/pedidos/mensais"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Mensais
                    </NavLink>
                    <NavLink
                      to="/pedidos/usou-pagou"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Usou e Pagou
                    </NavLink>
                  </div>
                </div>
              )
            }

            const isDespesas = item.to === '/despesas'

            if (isDespesas) {
              return (
                <div key={item.to} className={styles.navGroup}>
                  <div
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false)
                        setIsDespesasOpen(true)
                      } else {
                        setIsDespesasOpen(!isDespesasOpen)
                      }
                    }}
                    className={styles.navItem}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className={styles.navLabel}>
                      <span className={styles.navItemTitle}>{item.label}</span>
                      <span className={styles.navItemDesc}>{item.desc}</span>
                    </span>
                    {!isCollapsed && (
                      <span className={`${styles.chevron} ${isDespesasOpen ? styles.chevronOpen : ''}`}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    )}
                  </div>
                  
                  <div className={`${styles.subMenu} ${isDespesasOpen ? styles.subMenuOpen : styles.subMenuClosed}`}>
                    <NavLink
                      to="/despesas/lista"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Dashboard de despesas
                    </NavLink>
                    <NavLink
                      to="/despesas/criar"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Lançamento de despesa
                    </NavLink>
                  </div>
                </div>
              )
            }

            const isClientes = item.to === '/clientes'

            if (isClientes) {
              return (
                <div key={item.to} className={styles.navGroup}>
                  <div
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false)
                        setIsClientesOpen(true)
                      } else {
                        setIsClientesOpen(!isClientesOpen)
                      }
                    }}
                    className={styles.navItem}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className={styles.navLabel}>
                      <span className={styles.navItemTitle}>{item.label}</span>
                      <span className={styles.navItemDesc}>{item.desc}</span>
                    </span>
                    {!isCollapsed && (
                      <span className={`${styles.chevron} ${isClientesOpen ? styles.chevronOpen : ''}`}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    )}
                  </div>
                  
                  <div className={`${styles.subMenu} ${isClientesOpen ? styles.subMenuOpen : styles.subMenuClosed}`}>
                    <NavLink
                      to="/clientes/criar"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Novo cliente
                    </NavLink>
                    <NavLink
                      to="/clientes/lista"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Clientes cadastrados
                    </NavLink>
                  </div>
                </div>
              )
            }

            const isRelatorios = item.to === '/relatorios'

            if (isRelatorios) {
              return (
                <div key={item.to} className={styles.navGroup}>
                  <div
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false)
                        setIsRelatoriosOpen(true)
                      } else {
                        setIsRelatoriosOpen(!isRelatoriosOpen)
                      }
                    }}
                    className={styles.navItem}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className={styles.navLabel}>
                      <span className={styles.navItemTitle}>{item.label}</span>
                      <span className={styles.navItemDesc}>{item.desc}</span>
                    </span>
                    {!isCollapsed && (
                      <span className={`${styles.chevron} ${isRelatoriosOpen ? styles.chevronOpen : ''}`}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    )}
                  </div>
                  
                  <div className={`${styles.subMenu} ${isRelatoriosOpen ? styles.subMenuOpen : styles.subMenuClosed}`}>
                    <NavLink
                      to="/relatorios/mensal"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Relatório Mensal
                    </NavLink>
                    <NavLink
                      to="/relatorios/anual"
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        isActive ? `${styles.subNavItem} ${styles.subActive}` : styles.subNavItem
                      }
                    >
                      Relatório Anual
                    </NavLink>
                  </div>
                </div>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
                }
              >
                <span className={styles.navIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.navLabel}>
                  <span className={styles.navItemTitle}>{item.label}</span>
                  <span className={styles.navItemDesc}>{item.desc}</span>
                </span>
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={styles.sideFooter}>
          <div className={styles.dbStatus}>
            <span className={styles.dbDot} style={{ background: dot.color }} aria-hidden="true" />
            <span className={styles.sideFooterText}>{dot.label}</span>
          </div>

          <div className={styles.footerActions}>
            <button
              className={styles.themeBtn}
              type="button"
              onClick={handleToggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              <span className={styles.themeBtnIcon}>
                {theme === 'dark' ? Ico.sun : Ico.moon}
              </span>
              <span className={styles.themeBtnLabel}>
                {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </span>
            </button>

            <button
              className={`${styles.iconBtn} ${styles.logoutBtn}`}
              type="button"
              onClick={() => void supabase.auth.signOut()}
              title="Sair"
              aria-label="Sair"
            >
              {Ico.logout}
            </button>

            <button
              className={`${styles.iconBtn} ${styles.collapseBtn}`}
              type="button"
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              title={isCollapsed ? 'Expandir' : 'Recolher'}
            >
              {isCollapsed ? Ico.chevronRight : Ico.chevronLeft}
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main} role="main">
        <SetupBanner />
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>Ciclo Novo</span>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.muted}>Sistema de gestão v1.0</span>
      </footer>

      {/* ── Navegação inferior (mobile) ──────────────────── */}
      <nav className={styles.bottomNav} aria-label="Navegação rápida">
        {[
          { to: '/dashboard',      icon: Ico.dashboard,  label: 'Início'                      },
          { to: '/pedidos/lista',  icon: Ico.pedidos,    label: 'Pedidos'                     },
          { to: '/pedidos/criar',  icon: Ico.plus,       label: 'Novo',        isPlus: true   },
          { to: '/clientes',       icon: Ico.clientes,   label: 'Clientes'                    },
          { to: '/despesas/lista', icon: Ico.despesas,   label: 'Despesas'                    },
        ].map((item) => {
          if (item.isPlus) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? `${styles.bottomNavItem} ${styles.bottomNavPlus} ${styles.bottomNavPlusActive}`
                    : `${styles.bottomNavItem} ${styles.bottomNavPlus}`
                }
              >
                <span className={styles.bottomNavIcon}>{item.icon}</span>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </NavLink>
            )
          }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) => {
                  const isItemActive = isActive ||
                    (item.to === '/clientes' && location.pathname.startsWith('/clientes')) ||
                    (item.to === '/despesas/lista' && location.pathname.startsWith('/despesas')) ||
                    (item.to === '/pedidos/lista' && location.pathname.startsWith('/pedidos') && !location.pathname.includes('/criar'))
                  return isItemActive
                    ? `${styles.bottomNavItem} ${styles.bottomNavItemActive}`
                    : styles.bottomNavItem
                }}
              >
                <span className={styles.bottomNavIcon}>{item.icon}</span>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </NavLink>
            )
        })}
      </nav>
    </div>
  )
}
