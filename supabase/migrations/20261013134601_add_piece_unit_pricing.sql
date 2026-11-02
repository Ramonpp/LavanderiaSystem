begin;

alter table public.tipo_peca
  add column if not exists preco_unitario numeric not null default 0 check (preco_unitario >= 0);

alter table public.item_pedido
  add column if not exists preco_unitario numeric not null default 0 check (preco_unitario >= 0);

alter table public.pedido
  add column if not exists adicional_pecas numeric not null default 0 check (adicional_pecas >= 0);

insert into public.tipo_peca (nome, descricao, peso_referencia_kg, preco_unitario)
select 'Travesseiro', 'Travesseiro completo — cobrança por unidade', null, 20
where not exists (
  select 1 from public.tipo_peca where lower(trim(nome)) = 'travesseiro' and deletado_em is null
);

update public.tipo_peca
set preco_unitario = 20,
    descricao = coalesce(descricao, 'Travesseiro completo — cobrança por unidade')
where lower(trim(nome)) = 'travesseiro' and deletado_em is null;

create or replace function public.criar_pedido_com_itens(p_pedido jsonb, p_itens jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  novo_id uuid;
  item jsonb;
  total_adicional numeric := 0;
  preco_item numeric;
  quantidade_item integer;
begin
  if not private.usuario_autorizado() then raise exception 'Usuário não autorizado'; end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos'; end if;

  insert into public.pedido (
    cliente_id, data_pedido, data_prevista_entrega, status, pagamento_status,
    peso_kg, preco_por_kg, preco_fixo, desconto_valor, desconto_tipo,
    observacoes, foto_drive_id, deletado_em, adicional_pecas
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
    nullif(p_pedido->>'deletado_em', '')::timestamptz,
    0
  ) returning id into novo_id;

  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    quantidade_item := (item->>'quantidade')::integer;
    preco_item := coalesce(nullif(item->>'preco_unitario', '')::numeric, 0);
    insert into public.item_pedido (pedido_id, tipo_peca_id, quantidade, peso_linha_kg, pecas, preco_unitario)
    values (
      novo_id,
      (item->>'tipo_peca_id')::uuid,
      quantidade_item,
      nullif(item->>'peso_linha_kg', '')::numeric,
      case when item ? 'pecas' then item->'pecas' else null end,
      preco_item
    );
    total_adicional := total_adicional + quantidade_item * preco_item;
  end loop;

  update public.pedido set adicional_pecas = total_adicional where id = novo_id;
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
  total_adicional numeric := 0;
  preco_item numeric;
  quantidade_item integer;
begin
  if not private.usuario_autorizado() then raise exception 'Usuário não autorizado'; end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos'; end if;
  if not exists (select 1 from public.pedido where id = p_pedido_id and deletado_em is null) then
    raise exception 'Pedido não encontrado';
  end if;

  delete from public.item_pedido where pedido_id = p_pedido_id;

  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    quantidade_item := (item->>'quantidade')::integer;
    preco_item := coalesce(nullif(item->>'preco_unitario', '')::numeric, 0);
    insert into public.item_pedido (pedido_id, tipo_peca_id, quantidade, peso_linha_kg, pecas, preco_unitario)
    values (
      p_pedido_id,
      (item->>'tipo_peca_id')::uuid,
      quantidade_item,
      nullif(item->>'peso_linha_kg', '')::numeric,
      case when item ? 'pecas' then item->'pecas' else null end,
      preco_item
    );
    total_adicional := total_adicional + quantidade_item * preco_item;
  end loop;

  update public.pedido set adicional_pecas = total_adicional where id = p_pedido_id;
end;
$$;

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
  if not private.usuario_autorizado() then raise exception 'Usuário não autorizado'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'O valor do pagamento deve ser maior que zero'; end if;

  select greatest(
    0,
    ((case when p.preco_fixo is not null then p.preco_fixo else p.peso_kg * coalesce(p.preco_por_kg, 0) end)
      + coalesce(p.adicional_pecas, 0)) -
    (case
      when p.desconto_tipo = 'percentual' then
        ((case when p.preco_fixo is not null then p.preco_fixo else p.peso_kg * coalesce(p.preco_por_kg, 0) end)
          + coalesce(p.adicional_pecas, 0)) * coalesce(p.desconto_valor, 0) / 100
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

revoke all on function public.criar_pedido_com_itens(jsonb, jsonb) from public, anon;
revoke all on function public.substituir_itens_pedido(uuid, jsonb) from public, anon;
revoke all on function public.registrar_pagamento(uuid, numeric, public.cliente_forma_pagamento, text) from public, anon;
grant execute on function public.criar_pedido_com_itens(jsonb, jsonb) to authenticated;
grant execute on function public.substituir_itens_pedido(uuid, jsonb) to authenticated;
grant execute on function public.registrar_pagamento(uuid, numeric, public.cliente_forma_pagamento, text) to authenticated;

commit;
