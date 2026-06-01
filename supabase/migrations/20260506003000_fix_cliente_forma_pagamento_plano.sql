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

alter table public.cliente
  add column if not exists plano public.cliente_plano not null default 'pagou',
  add column if not exists forma_pagamento public.cliente_forma_pagamento not null default 'pix';

commit;

