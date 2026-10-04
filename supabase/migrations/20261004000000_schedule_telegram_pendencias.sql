-- Agendamento protegido do fechamento de pendências de sexta-feira.
begin;

create table if not exists public.telegram_automacao (
  id boolean primary key default true check (id),
  chave_cron text not null default (gen_random_uuid()::text || gen_random_uuid()::text),
  criado_em timestamptz not null default now()
);

alter table public.telegram_automacao enable row level security;
insert into public.telegram_automacao (id) values (true) on conflict (id) do nothing;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'telegram-pendencias-sexta';

select cron.schedule(
  'telegram-pendencias-sexta',
  '0 12 * * 5',
  $$
    select net.http_post(
      url := 'https://rdptufttwbgcckwledwx.supabase.co/functions/v1/telegram-pendencias',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-telegram-cron-key', (select chave_cron from public.telegram_automacao where id = true)
      ),
      body := '{}'::jsonb
    );
  $$
);

commit;
