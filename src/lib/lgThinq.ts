import { supabase } from './supabase'

export async function fetchLgEnergyUsage(
  deviceId: string,
  startDate: string,
  endDate: string
): Promise<{ energy_wh?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('lg-sincronizar', {
      body: { modo: 'consumo', device_id: deviceId, start_date: startDate, end_date: endDate },
    })
    if (error) return { error: error.message }
    const resultado = data?.maquinas?.[0]
    if (resultado?.erro) return { error: resultado.erro }
    if (typeof resultado?.energy_wh !== 'number') return { error: 'A LG não retornou o consumo da máquina.' }
    return { energy_wh: resultado.energy_wh }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
