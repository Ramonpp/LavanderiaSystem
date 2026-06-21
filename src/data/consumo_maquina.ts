import { supabase } from '../lib/supabase'
import type { ConsumoMaquina } from '../types/models'

export async function upsertConsumo(maquina_id: string, mes_ano: string, consumo_wh: number | null, ciclos: number) {
  try {
    const { data, error } = await supabase
      .from('consumo_maquina')
      .upsert({ maquina_id, mes_ano, consumo_wh, ciclos }, { onConflict: 'maquina_id,mes_ano' })
      .select('*')
      .single()


    if (error) {
      console.error('Erro ao salvar consumo_maquina:', error)
      return { error: error.message }
    }
    return { data: data as ConsumoMaquina }
  } catch (err: any) {
    return { error: err.message || 'Erro desconhecido ao salvar consumo.' }
  }
}

export async function fetchConsumos(mesAno?: string, maquinaId?: string) {
  try {
    let query = supabase.from('consumo_maquina').select('*')
    if (mesAno) {
      query = query.eq('mes_ano', mesAno)
    }
    if (maquinaId) {
      query = query.eq('maquina_id', maquinaId)
    }

    const { data, error } = await query
    if (error) {
      return { data: [], error: error.message }
    }
    return { data: (data as ConsumoMaquina[]) || [] }
  } catch (err: any) {
    return { data: [], error: err.message || 'Erro ao buscar consumos.' }
  }
}

export async function fetchConsumosAno(ano: string) {
  try {
    // Busca todos do ano selecionado, usando like
    const { data, error } = await supabase
      .from('consumo_maquina')
      .select('*')
      .like('mes_ano', `${ano}-%`)

    if (error) {
      return { data: [], error: error.message }
    }
    return { data: (data as ConsumoMaquina[]) || [] }
  } catch (err: any) {
    return { data: [], error: err.message || 'Erro ao buscar consumos do ano.' }
  }
}
