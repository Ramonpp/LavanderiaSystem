-- Migration inicial (Lavanderia • Enxoval)
-- Gerada a partir de supabase/schema.sql

-- Lavanderia (enxoval) — rode no SQL Editor do Supabase.
-- Produção: troque as policies RLS por autenticação (nunca use service_role no browser).

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.pedido_status as enum ('recebido','em_lavagem','pronto','entregue','cancelado');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.maquina_tipo as enum ('lavagem','secagem');
exception
  when duplicate_object then null;
end $$;

create or replace function public.lav_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create table if not exists public.cliente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  telefone text,
  email text,
  endereco text,
  condominio text,
  bloco text,
  apartamento text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists cliente_set_updated_at on public.cliente;
create trigger cliente_set_updated_at
before update on public.cliente
for each row execute function public.lav_touch_updated_at();

create table if not exists public.tipo_peca (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  peso_referencia_kg numeric,
  criado_em timestamptz not null default now()
);

create table if not exists public.pedido (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.cliente(id) on delete restrict,
  data_pedido date not null default (timezone('utc', now()))::date,
  data_prevista_entrega date,
  status public.pedido_status not null default 'recebido',
  peso_kg numeric not null check (peso_kg >= 0),
  preco_por_kg numeric,
  preco_fixo numeric,
  observacoes text,
  criado_em timestamptz not null default now(),
  constraint pedido_precificacao_ok check (
    (preco_por_kg is not null or preco_fixo is not null)
  )
);

create index if not exists pedido_data_pedido_idx on public.pedido (data_pedido);

create table if not exists public.item_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido(id) on delete cascade,
  tipo_peca_id uuid not null references public.tipo_peca(id) on delete restrict,
  quantidade int not null check (quantidade > 0),
  peso_linha_kg numeric,
  criado_em timestamptz not null default now()
);

create index if not exists item_pedido_pedido_id_idx on public.item_pedido (pedido_id);

create table if not exists public.despesa (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria text not null,
  descricao text,
  valor numeric not null check (valor >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists despesa_data_idx on public.despesa (data);

create table if not exists public.maquina (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.maquina_tipo not null,
  capacidade_kg numeric not null check (capacidade_kg > 0),
  minutos_por_ciclo numeric,
  ciclos_por_dia_util numeric not null check (ciclos_por_dia_util > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.app_config (
  id uuid primary key,
  dias_uteis_mes_padrao int not null default 22 check (dias_uteis_mes_padrao between 1 and 31),
  preco_referencia_kg numeric not null default 0,
  custo_variavel_estimado_por_kg numeric not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists app_config_set_updated_at on public.app_config;
create trigger app_config_set_updated_at
before update on public.app_config
for each row execute function public.lav_touch_updated_at();

insert into public.app_config (id, dias_uteis_mes_padrao, preco_referencia_kg, custo_variavel_estimado_por_kg)
values ('00000000-0000-0000-0000-000000000001', 22, 8.5, 2.2)
on conflict (id) do nothing;

-- RLS (MVP / testes): liberar acesso com a chave anon do frontend.
-- ATENÇÃO: isso expõe leitura/escrita pública.

alter table public.cliente enable row level security;
alter table public.tipo_peca enable row level security;
alter table public.pedido enable row level security;
alter table public.item_pedido enable row level security;
alter table public.despesa enable row level security;
alter table public.maquina enable row level security;
alter table public.app_config enable row level security;

drop policy if exists "dev_anon_cliente_all" on public.cliente;
create policy "dev_anon_cliente_all" on public.cliente for all using (true) with check (true);

drop policy if exists "dev_anon_tipo_peca_all" on public.tipo_peca;
create policy "dev_anon_tipo_peca_all" on public.tipo_peca for all using (true) with check (true);

drop policy if exists "dev_anon_pedido_all" on public.pedido;
create policy "dev_anon_pedido_all" on public.pedido for all using (true) with check (true);

drop policy if exists "dev_anon_item_pedido_all" on public.item_pedido;
create policy "dev_anon_item_pedido_all" on public.item_pedido for all using (true) with check (true);

drop policy if exists "dev_anon_despesa_all" on public.despesa;
create policy "dev_anon_despesa_all" on public.despesa for all using (true) with check (true);

drop policy if exists "dev_anon_maquina_all" on public.maquina;
create policy "dev_anon_maquina_all" on public.maquina for all using (true) with check (true);

drop policy if exists "dev_anon_app_config_all" on public.app_config;
create policy "dev_anon_app_config_all" on public.app_config for all using (true) with check (true);

commit;

