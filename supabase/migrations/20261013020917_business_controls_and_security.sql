begin;

-- Controles comerciais sem alterar nomes de clientes ou etapas operacionais.
alter table public.cliente
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists cobranca_pausada boolean not null default false,
  add column if not exists ultima_cobranca_em timestamptz;

alter table public.despesa
  add column if not exists vencimento date,
  add column if not exists pago boolean,
  add column if not exists data_pagamento date,
  add column if not exists recorrente boolean not null default false;

update public.despesa
set vencimento = data
where vencimento is null;

alter table public.maquina
  add column if not exists capacidade_secagem_kg numeric check (capacidade_secagem_kg > 0),
  add column if not exists litros_por_ciclo numeric check (litros_por_ciclo >= 0),
  add column if not exists energia_kwh_por_ciclo numeric check (energia_kwh_por_ciclo >= 0),
  add column if not exists ultima_manutencao date,
  add column if not exists ciclos_desde_manutencao integer not null default 0 check (ciclos_desde_manutencao >= 0),
  add column if not exists device_id text;

alter table public.consumo_maquina
  add column if not exists ciclos integer not null default 0 check (ciclos >= 0);

-- Registros temporários criados pela tela antiga não representam as duas LG VC4 reais.
update public.maquina m
set ativo = false
where lower(m.nome) in ('lavadora 753', 'lavadora 789')
  and not exists (select 1 from public.consumo_maquina c where c.maquina_id = m.id);

update public.maquina
set capacidade_kg = 14,
    capacidade_secagem_kg = coalesce(capacidade_secagem_kg, 8)
where ativo and lower(nome) like '%lg%' and lower(nome) like '%vc4%';

insert into public.maquina (nome, tipo, capacidade_kg, ciclos_por_dia_util, ativo)
select 'Secadora Brastemp 10kg', 'secagem', 10, 6, true
where not exists (
  select 1 from public.maquina where ativo and tipo = 'secagem' and lower(nome) like '%brastemp%'
);

insert into public.maquina (nome, tipo, capacidade_kg, ciclos_por_dia_util, ativo)
select 'Top Load 10kg', 'lavagem', 10, 5, true
where not exists (
  select 1 from public.maquina where ativo and lower(nome) like '%top%load%'
);

create table if not exists public.pagamento (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido(id) on delete restrict,
  valor numeric not null check (valor > 0),
  data date not null default current_date,
  forma public.cliente_forma_pagamento not null default 'pix',
  observacoes text,
  registrado_por uuid default auth.uid(),
  estornado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.cobranca_evento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.cliente(id) on delete restrict,
  pedido_id uuid references public.pedido(id) on delete set null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'telefone', 'presencial', 'outro')),
  mensagem text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

create index if not exists pedido_cliente_id_idx on public.pedido(cliente_id);
create index if not exists item_pedido_tipo_peca_id_idx on public.item_pedido(tipo_peca_id);
create index if not exists pagamento_pedido_id_idx on public.pagamento(pedido_id);
create index if not exists pagamento_data_idx on public.pagamento(data);
create index if not exists cobranca_evento_cliente_criado_idx on public.cobranca_evento(cliente_id, criado_em desc);
create index if not exists despesa_vencimento_idx on public.despesa(vencimento);

-- Lista privada de usuários autorizados. As contas atuais continuam funcionando.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists private.app_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'operador' check (papel in ('admin', 'operador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into private.app_usuario (user_id, papel)
select id, 'admin'
from auth.users
on conflict (user_id) do nothing;

alter table private.app_usuario enable row level security;

create or replace function private.usuario_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_usuario u
    where u.user_id = auth.uid() and u.ativo
  );
$$;

revoke all on function private.usuario_autorizado() from public, anon;
grant execute on function private.usuario_autorizado() to authenticated;

-- Remove políticas permissivas anteriores antes de criar uma regra única e auditável.
do $$
declare
  tabela text;
  politica record;
begin
  foreach tabela in array array[
    'cliente', 'tipo_peca', 'pedido', 'item_pedido', 'despesa', 'maquina',
    'app_config', 'consumo_maquina', 'resumo_mensal', 'pagamento', 'cobranca_evento'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabela);
    for politica in
      select policyname from pg_policies where schemaname = 'public' and tablename = tabela
    loop
      execute format('drop policy %I on public.%I', politica.policyname, tabela);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.usuario_autorizado())) with check ((select private.usuario_autorizado()))',
      'acesso_' || tabela || '_autorizado', tabela
    );
  end loop;
end $$;

-- Um pagamento e a atualização do saldo acontecem na mesma transação.
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
    (case
      when p.preco_fixo is not null then p.preco_fixo
      else p.peso_kg * coalesce(p.preco_por_kg, 0)
    end) -
    (case
      when p.desconto_tipo = 'percentual' then
        (case when p.preco_fixo is not null then p.preco_fixo else p.peso_kg * coalesce(p.preco_por_kg, 0) end)
        * coalesce(p.desconto_valor, 0) / 100
      when p.desconto_tipo = 'fixo' then coalesce(p.desconto_valor, 0)
      else 0
    end)
  )
  into total_pedido
  from public.pedido p
  where p.id = p_pedido_id and p.deletado_em is null
  for update;

  if total_pedido is null then
    raise exception 'Pedido não encontrado';
  end if;

  insert into public.pagamento (pedido_id, valor, forma, observacoes)
  values (p_pedido_id, p_valor, p_forma, nullif(trim(p_observacoes), ''))
  returning * into novo_pagamento;

  select coalesce(sum(valor), 0)
  into total_pago
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

-- Corrige funções antigas apontadas pelos avisos de segurança.
create or replace function public.lav_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create or replace function public.expurgar_registros_deletados_30_dias()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.item_pedido
  where pedido_id in (
    select id from public.pedido
    where deletado_em is not null and deletado_em < now() - interval '30 days'
  );

  delete from public.pedido
  where deletado_em is not null
    and deletado_em < now() - interval '30 days'
    and not exists (select 1 from public.pagamento pg where pg.pedido_id = public.pedido.id);

  delete from public.cliente c
  where ((c.deletado_em is not null and c.deletado_em < now() - interval '30 days')
      or (c.ativo = false and c.atualizado_em < now() - interval '30 days'))
    and not exists (select 1 from public.pedido p where p.cliente_id = c.id)
    and not exists (select 1 from public.cobranca_evento ce where ce.cliente_id = c.id);

  delete from public.despesa where deletado_em is not null and deletado_em < now() - interval '30 days';
  delete from public.maquina where deletado_em is not null and deletado_em < now() - interval '30 days';
  delete from public.tipo_peca tp
  where tp.deletado_em is not null and tp.deletado_em < now() - interval '30 days'
    and not exists (select 1 from public.item_pedido ip where ip.tipo_peca_id = tp.id);
end;
$$;

revoke all on function public.expurgar_registros_deletados_30_dias() from public, anon, authenticated;

commit;
