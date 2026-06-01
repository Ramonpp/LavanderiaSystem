begin;

do $$ begin
  create type public.cliente_plano as enum ('pagou','mensal','quinzenal');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.cliente_forma_pagamento as enum ('pix','dinheiro','cartao','transferencia','outro');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.pedido_pagamento_status as enum ('pago','devendo','em_andamento');
exception
  when duplicate_object then null;
end $$;

alter table public.cliente
  add column if not exists plano public.cliente_plano not null default 'pagou',
  add column if not exists forma_pagamento public.cliente_forma_pagamento not null default 'pix';

alter table public.pedido
  add column if not exists pagamento_status public.pedido_pagamento_status not null default 'devendo';

alter table public.app_config
  add column if not exists webhook_url text;

commit;

