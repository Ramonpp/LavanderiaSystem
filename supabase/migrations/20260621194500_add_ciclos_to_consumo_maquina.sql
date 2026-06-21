-- Migration: Add column ciclos to public.consumo_maquina
begin;

alter table public.consumo_maquina add column if not exists ciclos integer not null default 0;

commit;
