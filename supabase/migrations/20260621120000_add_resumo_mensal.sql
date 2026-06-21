-- Migration: tabela resumo_mensal para histórico consolidado por mês
begin;

create table if not exists public.resumo_mensal (
  id            uuid         primary key default gen_random_uuid(),
  mes_ano       text         not null unique,            -- 'YYYY-MM'
  total_pedidos int          not null default 0,
  total_kg      numeric(10,2) not null default 0,
  custo_energia numeric(10,2) not null default 0,       -- R$ gasto com luz no mês
  custo_agua    numeric(10,2) not null default 0,       -- R$ gasto com água no mês
  criado_em     timestamptz  not null default now(),
  atualizado_em timestamptz  not null default now()
);

alter table public.resumo_mensal enable row level security;

drop policy if exists "dev_anon_resumo_mensal_all" on public.resumo_mensal;
create policy "dev_anon_resumo_mensal_all" on public.resumo_mensal
  for all using (true) with check (true);

commit;
