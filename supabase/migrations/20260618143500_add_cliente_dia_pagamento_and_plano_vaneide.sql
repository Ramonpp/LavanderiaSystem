-- Add 'vaneide' to cliente_plano enum if it doesn't exist.
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in Postgres.
-- So we execute these commands.
ALTER TYPE public.cliente_plano ADD VALUE IF NOT EXISTS 'vaneide';

-- Add dia_pagamento column to cliente table.
ALTER TABLE public.cliente ADD COLUMN IF NOT EXISTS dia_pagamento int;
