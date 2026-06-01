# Supabase (automático) — criação de tabelas

## Importante (segurança)

- Use no frontend **somente** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Nunca** use `service_role`/secret no Vite/React.
- Se você vazou chaves, **rotacione** no Supabase e atualize seu `.env.local`.

## 1) Aplicar schema no Supabase remoto (recomendado)

Pré-requisito: você precisa do **project ref** (ex.: `abcdefghijklmnopqrs`) do seu projeto.

No Windows (bash), na raiz do projeto:

```bash
export SUPABASE_PROJECT_REF="<seu-project-ref>"
npm run sb:link
npm run sb:push
```

Isso aplica as migrations em `supabase/migrations/` e cria as tabelas automaticamente.

## 2) Rodar Supabase local (opcional)

Requer Docker.

```bash
npm run sb:start
npm run sb:reset
```

## 3) Variáveis do frontend

Crie `./.env.local` a partir de `.env.example`:

```bash
cp .env.example .env.local
```

Depois preencha:

- `VITE_SUPABASE_URL` (seu projeto): `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` (pegue em **Project Settings → API → anon public**)

Em seguida, reinicie o frontend:

```bash
npm run dev
```

