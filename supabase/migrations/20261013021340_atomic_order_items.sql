begin;

create or replace function public.criar_pedido_com_itens(p_pedido jsonb, p_itens jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  novo_id uuid;
  item jsonb;
begin
  if not private.usuario_autorizado() then raise exception 'Usuário não autorizado'; end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos'; end if;

  insert into public.pedido (
    cliente_id, data_pedido, data_prevista_entrega, status, pagamento_status,
    peso_kg, preco_por_kg, preco_fixo, desconto_valor, desconto_tipo,
    observacoes, foto_drive_id, deletado_em
  ) values (
    (p_pedido->>'cliente_id')::uuid,
    coalesce((p_pedido->>'data_pedido')::date, current_date),
    nullif(p_pedido->>'data_prevista_entrega', '')::date,
    coalesce(nullif(p_pedido->>'status', '')::public.pedido_status, 'recebido'),
    coalesce(nullif(p_pedido->>'pagamento_status', '')::public.pedido_pagamento_status, 'devendo'),
    coalesce((p_pedido->>'peso_kg')::numeric, 0),
    nullif(p_pedido->>'preco_por_kg', '')::numeric,
    nullif(p_pedido->>'preco_fixo', '')::numeric,
    coalesce(nullif(p_pedido->>'desconto_valor', '')::numeric, 0),
    coalesce(nullif(p_pedido->>'desconto_tipo', ''), 'fixo'),
    nullif(p_pedido->>'observacoes', ''),
    nullif(p_pedido->>'foto_drive_id', ''),
    nullif(p_pedido->>'deletado_em', '')::timestamptz
  ) returning id into novo_id;

  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    insert into public.item_pedido (pedido_id, tipo_peca_id, quantidade, peso_linha_kg, pecas)
    values (
      novo_id,
      (item->>'tipo_peca_id')::uuid,
      (item->>'quantidade')::integer,
      nullif(item->>'peso_linha_kg', '')::numeric,
      case when item ? 'pecas' then item->'pecas' else null end
    );
  end loop;

  return novo_id;
end;
$$;

create or replace function public.substituir_itens_pedido(p_pedido_id uuid, p_itens jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
begin
  if not private.usuario_autorizado() then raise exception 'Usuário não autorizado'; end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos'; end if;
  if not exists (select 1 from public.pedido where id = p_pedido_id and deletado_em is null) then
    raise exception 'Pedido não encontrado';
  end if;

  delete from public.item_pedido where pedido_id = p_pedido_id;

  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    insert into public.item_pedido (pedido_id, tipo_peca_id, quantidade, peso_linha_kg, pecas)
    values (
      p_pedido_id,
      (item->>'tipo_peca_id')::uuid,
      (item->>'quantidade')::integer,
      nullif(item->>'peso_linha_kg', '')::numeric,
      case when item ? 'pecas' then item->'pecas' else null end
    );
  end loop;
end;
$$;

revoke all on function public.criar_pedido_com_itens(jsonb, jsonb) from public, anon;
revoke all on function public.substituir_itens_pedido(uuid, jsonb) from public, anon;
grant execute on function public.criar_pedido_com_itens(jsonb, jsonb) to authenticated;
grant execute on function public.substituir_itens_pedido(uuid, jsonb) to authenticated;

commit;
