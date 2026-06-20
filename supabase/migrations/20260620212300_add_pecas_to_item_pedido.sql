-- Adiciona coluna pecas no item_pedido para controle individual das pecas
alter table public.item_pedido add column if not exists pecas jsonb default '[]'::jsonb;
