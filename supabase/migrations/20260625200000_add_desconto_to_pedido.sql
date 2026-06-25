-- Migration: Add desconto_valor and desconto_tipo to pedido table
begin;

alter table public.pedido
  add column if not exists desconto_valor numeric not null default 0 check (desconto_valor >= 0),
  add column if not exists desconto_tipo text not null default 'fixo' check (desconto_tipo in ('percentual', 'fixo'));

commit;
