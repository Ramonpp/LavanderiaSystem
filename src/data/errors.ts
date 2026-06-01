export function dbErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Erro desconhecido'
  const maybe = err as { message?: string; details?: string; hint?: string; code?: string }
  const base = typeof maybe.message === 'string' ? maybe.message : 'Erro no banco'
  const extras = [maybe.details, maybe.hint].filter(Boolean).join(' — ')
  return extras ? `${base} (${extras})` : base
}
