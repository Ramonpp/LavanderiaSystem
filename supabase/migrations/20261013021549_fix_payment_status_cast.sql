begin;

create or replace function public.registrar_pagamento(
  p_pedido_id uuid,
  p_valor numeric,
  p_forma public.cliente_forma_pagamento,
  p_observacoes text default null
)
returns public.pagamento
language plpgsql
set search_path = ''
as $$
declare
  novo_pagamento public.pagamento;
  total_pedido numeric;
  total_pago numeric;
begin
  if not private.usuario_autorizado() then
    raise exception 'Usuário não autorizado';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor do pagamento deve ser maior que zero';
  end if;

  select greatest(
    0,
    (case when p.preco_fixo is not null then p.preco_fixo else p.peso_kg * coalesce(p.preco_por_kg, 0) end) -
    (case
      when p.desconto_tipo = 'percentual' then
        (case when p.preco_fixo is not null then p.preco_fixo else p.peso_kg * coalesce(p.preco_por_kg, 0) end)
        * coalesce(p.desconto_valor, 0) / 100
      when p.desconto_tipo = 'fixo' then coalesce(p.desconto_valor, 0)
      else 0
    end)
  ) into total_pedido
  from public.pedido p
  where p.id = p_pedido_id and p.deletado_em is null
  for update;

  if total_pedido is null then raise exception 'Pedido não encontrado'; end if;

  insert into public.pagamento (pedido_id, valor, forma, observacoes)
  values (p_pedido_id, p_valor, p_forma, nullif(trim(p_observacoes), ''))
  returning * into novo_pagamento;

  select coalesce(sum(valor), 0) into total_pago
  from public.pagamento
  where pedido_id = p_pedido_id and estornado_em is null;

  update public.pedido
  set pagamento_status = case
    when total_pago >= total_pedido then 'pago'::public.pedido_pagamento_status
    else 'em_andamento'::public.pedido_pagamento_status
  end
  where id = p_pedido_id;

  return novo_pagamento;
end;
$$;

revoke all on function public.registrar_pagamento(uuid, numeric, public.cliente_forma_pagamento, text) from public, anon;
grant execute on function public.registrar_pagamento(uuid, numeric, public.cliente_forma_pagamento, text) to authenticated;

commit;
