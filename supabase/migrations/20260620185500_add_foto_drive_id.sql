-- Adiciona coluna para guardar o ID do arquivo no Google Drive
alter table public.pedido add column if not exists foto_drive_id text;
