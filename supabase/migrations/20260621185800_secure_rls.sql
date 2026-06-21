-- Migration: Secure RLS policies to allow access only to authenticated users
begin;

-- 1. cliente
drop policy if exists "dev_anon_cliente_all" on public.cliente;
create policy "auth_cliente_all" on public.cliente 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2. tipo_peca
drop policy if exists "dev_anon_tipo_peca_all" on public.tipo_peca;
create policy "auth_tipo_peca_all" on public.tipo_peca 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3. pedido
drop policy if exists "dev_anon_pedido_all" on public.pedido;
create policy "auth_pedido_all" on public.pedido 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. item_pedido
drop policy if exists "dev_anon_item_pedido_all" on public.item_pedido;
create policy "auth_item_pedido_all" on public.item_pedido 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 5. despesa
drop policy if exists "dev_anon_despesa_all" on public.despesa;
create policy "auth_despesa_all" on public.despesa 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 6. maquina
drop policy if exists "dev_anon_maquina_all" on public.maquina;
create policy "auth_maquina_all" on public.maquina 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 7. app_config
drop policy if exists "dev_anon_app_config_all" on public.app_config;
create policy "auth_app_config_all" on public.app_config 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 8. consumo_maquina
drop policy if exists "dev_anon_consumo_maquina_all" on public.consumo_maquina;
create policy "auth_consumo_maquina_all" on public.consumo_maquina 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 9. resumo_mensal
drop policy if exists "dev_anon_resumo_mensal_all" on public.resumo_mensal;
create policy "auth_resumo_mensal_all" on public.resumo_mensal 
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

commit;
