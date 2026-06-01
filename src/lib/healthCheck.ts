import { supabase } from './supabase'

export type DbHealth = 'checking' | 'ok' | 'schema_missing' | 'unreachable'

/** Verifica se o banco remoto está acessível e com o schema aplicado. */
export async function checkDbHealth(): Promise<DbHealth> {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return 'unreachable'
  }

  try {
    const { error } = await supabase.from('app_config').select('id').limit(1).maybeSingle()

    if (!error) return 'ok'

    // PGRST205 = tabela não encontrada no schema cache (schema não aplicado)
    // PGRST301 / 42P01 = relação não existe
    const code = (error as { code?: string }).code ?? ''
    const msg  = (error as { message?: string }).message ?? ''

    if (
      code === 'PGRST205' ||
      code === '42P01' ||
      msg.toLowerCase().includes('schema cache') ||
      msg.toLowerCase().includes('does not exist')
    ) {
      return 'schema_missing'
    }

    return 'unreachable'
  } catch {
    return 'unreachable'
  }
}
