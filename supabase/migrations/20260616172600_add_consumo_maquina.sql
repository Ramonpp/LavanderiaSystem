-- Migration: Add table consumo_maquina to track monthly energy consumption
begin;

create table if not exists public.consumo_maquina (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.maquina(id) on delete cascade,
  mes_ano text not null, -- formato 'YYYY-MM'
  consumo_wh numeric not null check (consumo_wh >= 0),
  criado_em timestamptz not null default now(),
  constraint consumo_maquina_unique_maquina_mes_ano unique(maquina_id, mes_ano)
);

-- Habilitar RLS
alter table public.consumo_maquina enable row level security;

-- Criar política de acesso anônimo para desenvolvimento/MVP
drop policy if exists "dev_anon_consumo_maquina_all" on public.consumo_maquina;
create policy "dev_anon_consumo_maquina_all" on public.consumo_maquina 
  for all using (true) with check (true);

commit;
