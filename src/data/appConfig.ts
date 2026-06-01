import { supabase } from '../lib/supabase'
import type { AppConfig } from '../types/models'
import { dbErrorMessage } from './errors'

export const APP_CONFIG_SINGLETON_ID = '00000000-0000-0000-0000-000000000001'

export async function fetchAppConfig(): Promise<{ data: AppConfig | null; error: string | null }> {
  const { data, error } = await supabase.from('app_config').select('*').limit(1).maybeSingle()

  return { data: (data as AppConfig | null) ?? null, error: error ? dbErrorMessage(error) : null }
}

export async function updateAppConfig(
  patch: Partial<Pick<AppConfig, 'dias_uteis_mes_padrao' | 'preco_referencia_kg' | 'custo_variavel_estimado_por_kg' | 'webhook_url'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('app_config').update(patch).eq('id', APP_CONFIG_SINGLETON_ID)
  return { error: error ? dbErrorMessage(error) : null }
}
