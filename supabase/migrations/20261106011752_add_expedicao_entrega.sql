begin;

alter table public.pedido
  add column if not exists foto_entrega_drive_id text,
  add column if not exists expedicao_em timestamptz,
  add column if not exists entrega_mensagem_enviada_em timestamptz,
  add column if not exists entregue_em timestamptz;

create index if not exists pedido_status_expedicao_idx
  on public.pedido (status, data_prevista_entrega)
  where deletado_em is null and status = 'pronto';

commit;
