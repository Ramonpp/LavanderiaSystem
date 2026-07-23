-- Migration: Add soft delete (deletado_em) and 30-day auto purge function
begin;

-- Adiciona a coluna deletado_em nas tabelas principais se ainda não existir
alter table public.cliente add column if not exists deletado_em timestamptz default null;
alter table public.pedido add column if not exists deletado_em timestamptz default null;
alter table public.despesa add column if not exists deletado_em timestamptz default null;
alter table public.maquina add column if not exists deletado_em timestamptz default null;
alter table public.tipo_peca add column if not exists deletado_em timestamptz default null;

-- Índices para otimizar a filtragem dos não-deletados e a busca por expurgo
create index if not exists cliente_deletado_em_idx on public.cliente (deletado_em) where deletado_em is null;
create index if not exists pedido_deletado_em_idx on public.pedido (deletado_em) where deletado_em is null;
create index if not exists despesa_deletado_em_idx on public.despesa (deletado_em) where deletado_em is null;
create index if not exists maquina_deletado_em_idx on public.maquina (deletado_em) where deletado_em is null;
create index if not exists tipo_peca_deletado_em_idx on public.tipo_peca (deletado_em) where deletado_em is null;

-- Função para expurgar registros desativados há mais de 30 dias
create or replace function public.expurgar_registros_deletados_30_dias()
returns void
language plpgsql
security definer
as $$
begin
  -- Exclui permanentemente os itens de pedidos deletados há +30 dias
  delete from public.item_pedido 
  where pedido_id in (
    select id from public.pedido where deletado_em is not null and deletado_em < now() - interval '30 days'
  );

  -- Exclui permanentemente pedidos deletados há +30 dias
  delete from public.pedido 
  where deletado_em is not null and deletado_em < now() - interval '30 days';

  -- Exclui permanentemente clientes desativados/deletados há +30 dias
  delete from public.cliente 
  where (deletado_em is not null and deletado_em < now() - interval '30 days')
     or (ativo = false and atualizado_em < now() - interval '30 days');

  -- Exclui permanentemente despesas deletadas há +30 dias
  delete from public.despesa 
  where deletado_em is not null and deletado_em < now() - interval '30 days';

  -- Exclui permanentemente máquinas desativadas/deletadas há +30 dias
  delete from public.maquina 
  where (deletado_em is not null and deletado_em < now() - interval '30 days')
     or (ativo = false and criado_em < now() - interval '30 days');

  -- Exclui permanentemente tipos de peça deletados há +30 dias
  delete from public.tipo_peca 
  where deletado_em is not null and deletado_em < now() - interval '30 days';
end;
$$;

-- Tenta agendar o cron job diário (se a extensão pg_cron estiver ativada no Supabase)
do $$ begin
  perform cron.schedule(
    'expurgar-deletados-30-dias',
    '0 3 * * *',
    $$ select public.expurgar_registros_deletados_30_dias() $$
  );
exception when others then null;
end $$;

commit;
