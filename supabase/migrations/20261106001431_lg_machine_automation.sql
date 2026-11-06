begin;

create table if not exists public.lg_automacao (
  id boolean primary key default true check (id),
  chave_cron text not null default (gen_random_uuid()::text || gen_random_uuid()::text),
  criado_em timestamptz not null default now()
);

insert into public.lg_automacao (id) values (true)
on conflict (id) do nothing;

alter table public.lg_automacao enable row level security;
drop policy if exists "servico_lg_automacao" on public.lg_automacao;
create policy "servico_lg_automacao" on public.lg_automacao
  for all to service_role using (true) with check (true);

create table if not exists public.maquina_estado_lg (
  maquina_id uuid primary key references public.maquina(id) on delete cascade,
  ultimo_estado text,
  ciclo_em_andamento boolean not null default false,
  ciclo_iniciado_em timestamptz,
  ultima_sincronizacao_em timestamptz,
  ultimo_erro text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.maquina_ciclo_lg (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.maquina(id) on delete cascade,
  iniciado_em timestamptz not null,
  finalizado_em timestamptz not null,
  estado_final text not null,
  criado_em timestamptz not null default now(),
  constraint maquina_ciclo_lg_periodo_valido check (finalizado_em >= iniciado_em),
  constraint maquina_ciclo_lg_unico unique (maquina_id, iniciado_em)
);

create table if not exists public.maquina_consumo_diario (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.maquina(id) on delete cascade,
  data_referencia date not null,
  consumo_wh numeric not null check (consumo_wh >= 0),
  sincronizado_em timestamptz not null default now(),
  constraint maquina_consumo_diario_unico unique (maquina_id, data_referencia)
);

create index if not exists maquina_ciclo_lg_maquina_finalizado_idx
  on public.maquina_ciclo_lg (maquina_id, finalizado_em desc);
create index if not exists maquina_consumo_diario_maquina_data_idx
  on public.maquina_consumo_diario (maquina_id, data_referencia desc);
create unique index if not exists maquina_device_id_unico
  on public.maquina (device_id) where device_id is not null;

alter table public.maquina_estado_lg enable row level security;
alter table public.maquina_ciclo_lg enable row level security;
alter table public.maquina_consumo_diario enable row level security;

drop policy if exists "acesso_maquina_estado_lg_autorizado" on public.maquina_estado_lg;
create policy "acesso_maquina_estado_lg_autorizado" on public.maquina_estado_lg
  for all to authenticated
  using ((select private.usuario_autorizado()))
  with check ((select private.usuario_autorizado()));

drop policy if exists "acesso_maquina_ciclo_lg_autorizado" on public.maquina_ciclo_lg;
create policy "acesso_maquina_ciclo_lg_autorizado" on public.maquina_ciclo_lg
  for all to authenticated
  using ((select private.usuario_autorizado()))
  with check ((select private.usuario_autorizado()));

drop policy if exists "acesso_maquina_consumo_diario_autorizado" on public.maquina_consumo_diario;
create policy "acesso_maquina_consumo_diario_autorizado" on public.maquina_consumo_diario
  for all to authenticated
  using ((select private.usuario_autorizado()))
  with check ((select private.usuario_autorizado()));

create or replace function public.registrar_ciclo_lg(
  p_maquina_id uuid,
  p_iniciado_em timestamptz,
  p_finalizado_em timestamptz,
  p_estado_final text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserido uuid;
  v_mes text;
begin
  insert into public.maquina_ciclo_lg (maquina_id, iniciado_em, finalizado_em, estado_final)
  values (p_maquina_id, p_iniciado_em, p_finalizado_em, p_estado_final)
  on conflict (maquina_id, iniciado_em) do nothing
  returning id into v_inserido;

  if v_inserido is null then
    return false;
  end if;

  v_mes := to_char(p_finalizado_em at time zone 'America/Sao_Paulo', 'YYYY-MM');

  insert into public.consumo_maquina (maquina_id, mes_ano, consumo_wh, ciclos)
  values (p_maquina_id, v_mes, 0, 1)
  on conflict (maquina_id, mes_ano) do update
    set ciclos = public.consumo_maquina.ciclos + 1;

  update public.maquina
  set ciclos_desde_manutencao = ciclos_desde_manutencao + 1
  where id = p_maquina_id;

  return true;
end;
$$;

revoke all on function public.registrar_ciclo_lg(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.registrar_ciclo_lg(uuid, timestamptz, timestamptz, text) to service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'lg-estados-cada-5-minutos';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  select jobid into v_job_id from cron.job where jobname = 'lg-consumo-diario-20h';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;

select cron.schedule(
  'lg-estados-cada-5-minutos',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://rdptufttwbgcckwledwx.supabase.co/functions/v1/lg-sincronizar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-lg-cron-key', (select chave_cron from public.lg_automacao where id = true)
      ),
      body := '{"modo":"estado"}'::jsonb
    );
  $cron$
);

-- O cron usa UTC: 23:00 UTC corresponde a 20:00 em America/Sao_Paulo.
select cron.schedule(
  'lg-consumo-diario-20h',
  '0 23 * * *',
  $cron$
    select net.http_post(
      url := 'https://rdptufttwbgcckwledwx.supabase.co/functions/v1/lg-sincronizar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-lg-cron-key', (select chave_cron from public.lg_automacao where id = true)
      ),
      body := '{"modo":"consumo"}'::jsonb
    );
  $cron$
);

commit;
