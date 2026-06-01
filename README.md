# Ciclo Novo — Gestão de Lavanderia

Sistema web para gestão operacional e financeira de lavanderia: pedidos, clientes, máquinas, despesas, relatórios e simulação de capacidade.

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (Postgres + API REST)
- **Roteamento:** React Router

## Pré-requisitos

- Node.js 20+
- Conta e projeto no [Supabase](https://supabase.com)

## Instalação

```bash
git clone https://github.com/Ramonpp/LavanderiaSystem.git
cd LavanderiaSystem
npm install
cp .env.example .env.local
```

Edite `.env.local` com a URL e a chave **anon** do seu projeto (Settings → API no Supabase).

## Banco de dados

Aplique as migrations no Supabase remoto:

```bash
export SUPABASE_PROJECT_REF="<seu-project-ref>"
npm run sb:link
npm run sb:push
```

Detalhes em [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run sb:push` | Aplica migrations no Supabase |
| `npm run lint` | ESLint |

## Estrutura

- `src/pages/` — telas (dashboard, pedidos, clientes, etc.)
- `src/data/` — acesso ao Supabase
- `src/domain/` — regras de negócio (financeiro, operação)
- `supabase/migrations/` — schema e evolução do banco

## Segurança

- Não commite `.env.local` nem chaves `service_role`.
- No frontend use apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
