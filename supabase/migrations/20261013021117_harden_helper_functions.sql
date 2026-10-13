begin;

create index if not exists cobranca_evento_pedido_id_idx
  on public.cobranca_evento(pedido_id);

-- A tabela fica fora da API e só é lida pela função security definer.
alter table private.app_usuario disable row level security;
revoke all on table private.app_usuario from public, anon, authenticated;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

commit;
