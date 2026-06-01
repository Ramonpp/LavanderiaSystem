export type Theme = 'light' | 'dark'

const KEY = 'lav-theme'

/** Lê a preferência salva. null = seguir sistema. */
export function getSavedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* noop */ }
  return null
}

/** Resolve o tema ativo (salvo ou sistema). */
export function resolveTheme(): Theme {
  const saved = getSavedTheme()
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Aplica o tema no <html> e persiste. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(KEY, theme) } catch { /* noop */ }
}

/** Alterna entre light ↔ dark. */
export function toggleTheme(): Theme {
  const next = resolveTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

/** Aplica o tema salvo (ou o do sistema) sem persistir. Chamado no boot. */
export function applyInitialTheme() {
  const theme = resolveTheme()
  document.documentElement.setAttribute('data-theme', theme)
}
