-- Adiciona campos de condomínio/bloco/apto em cliente
begin;

alter table public.cliente
  add column if not exists condominio text,
  add column if not exists bloco text,
  add column if not exists apartamento text;

commit;

