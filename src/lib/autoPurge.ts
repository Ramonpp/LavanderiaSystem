import { supabase } from './supabase'

let purgeExecuted = false

/**
 * Expurga automaticamente registros desativados/deletados há mais de 30 dias.
 * Executa uma única vez por sessão do app em segundo plano sem bloquear a UI.
 */
export async function executarExpurgoAutomatico30Dias() {
  if (purgeExecuted) return
  purgeExecuted = true

  try {
    // 1. Executa a função RPC no Supabase (se criada)
    const { error: rpcError } = await supabase.rpc('expurgar_registros_deletados_30_dias')
    if (!rpcError) {
      return
    }

    // 2. Fallback via cliente caso a função RPC não esteja criada no banco ainda:
    const dataLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Expurga pedidos deletados há +30 dias
    try {
      const { data: pedsDeletados } = await supabase
        .from('pedido')
        .select('id')
        .lt('deletado_em', dataLimite)

      if (pedsDeletados && pedsDeletados.length > 0) {
        const ids = pedsDeletados.map((p) => p.id)
        await supabase.from('item_pedido').delete().in('pedido_id', ids)
        await supabase.from('pedido').delete().in('id', ids)
      }
    } catch { /* ignora */ }

    // Expurga despesas deletadas há +30 dias
    try {
      await supabase.from('despesa').delete().lt('deletado_em', dataLimite)
    } catch { /* ignora */ }

    // Expurga clientes desativados/deletados há +30 dias
    try {
      await supabase.from('cliente').delete().or(`deletado_em.lt.${dataLimite},and(ativo.eq.false,atualizado_em.lt.${dataLimite})`)
    } catch { /* ignora */ }

    // Expurga máquinas desativadas/deletadas há +30 dias
    try {
      await supabase.from('maquina').delete().or(`deletado_em.lt.${dataLimite},and(ativo.eq.false,criado_em.lt.${dataLimite})`)
    } catch { /* ignora */ }

    // Expurga tipos de peça deletados há +30 dias
    try {
      await supabase.from('tipo_peca').delete().lt('deletado_em', dataLimite)
    } catch { /* ignora */ }

  } catch {
    // Erros de expurgo automático não travam a navegação
  }
}
