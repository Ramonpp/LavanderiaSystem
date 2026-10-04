-- Consolida clientes ativos com o mesmo nome e apartamento.
-- Preserva o cadastro mais completo e transfere os pedidos para ele.
begin;

alter table public.cliente add column if not exists deletado_em timestamptz default null;

-- Complementa campos vazios do cadastro principal com dados do duplicado.
with classificados as (
  select id, first_value(id) over (
    partition by lower(btrim(nome)), lower(btrim(apartamento))
    order by ativo desc,
      ((documento is not null)::int + (telefone is not null)::int + (email is not null)::int + (endereco is not null)::int + (condominio is not null)::int + (bloco is not null)::int) desc,
      criado_em asc, id
  ) as cliente_principal
  from public.cliente
  where deletado_em is null and nullif(btrim(apartamento), '') is not null
), dados_duplicados as (
  select c.cliente_principal,
    max(x.documento) filter (where x.id <> c.cliente_principal) as documento,
    max(x.telefone) filter (where x.id <> c.cliente_principal) as telefone,
    max(x.email) filter (where x.id <> c.cliente_principal) as email,
    max(x.endereco) filter (where x.id <> c.cliente_principal) as endereco,
    max(x.condominio) filter (where x.id <> c.cliente_principal) as condominio,
    max(x.bloco) filter (where x.id <> c.cliente_principal) as bloco
  from classificados c join public.cliente x on x.id = c.id
  group by c.cliente_principal
)
update public.cliente principal
set documento = coalesce(principal.documento, dados_duplicados.documento),
    telefone = coalesce(principal.telefone, dados_duplicados.telefone),
    email = coalesce(principal.email, dados_duplicados.email),
    endereco = coalesce(principal.endereco, dados_duplicados.endereco),
    condominio = coalesce(principal.condominio, dados_duplicados.condominio),
    bloco = coalesce(principal.bloco, dados_duplicados.bloco)
from dados_duplicados
where principal.id = dados_duplicados.cliente_principal;

-- Reaponta todos os pedidos para o cliente principal do grupo.
with classificados as (
  select id, first_value(id) over (
    partition by lower(btrim(nome)), lower(btrim(apartamento))
    order by ativo desc,
      ((documento is not null)::int + (telefone is not null)::int + (email is not null)::int + (endereco is not null)::int + (condominio is not null)::int + (bloco is not null)::int) desc,
      criado_em asc, id
  ) as cliente_principal
  from public.cliente
  where deletado_em is null and nullif(btrim(apartamento), '') is not null
)
update public.pedido pedido
set cliente_id = classificados.cliente_principal
from classificados
where pedido.cliente_id = classificados.id and classificados.id <> classificados.cliente_principal;

-- Desativa os registros mesclados para manter auditoria sem apagar informaÃ§Ãµes.
with classificados as (
  select id, first_value(id) over (
    partition by lower(btrim(nome)), lower(btrim(apartamento))
    order by ativo desc,
      ((documento is not null)::int + (telefone is not null)::int + (email is not null)::int + (endereco is not null)::int + (condominio is not null)::int + (bloco is not null)::int) desc,
      criado_em asc, id
  ) as cliente_principal
  from public.cliente
  where deletado_em is null and nullif(btrim(apartamento), '') is not null
)
update public.cliente cliente
set ativo = false, deletado_em = now()
from classificados
where cliente.id = classificados.id and classificados.id <> classificados.cliente_principal;

-- Impede a criaÃ§Ã£o de um novo duplicado, ignorando diferenÃ§as de maiÃºsculas e espaÃ§os.
create unique index if not exists cliente_nome_apartamento_unico_idx
  on public.cliente (lower(btrim(nome)), lower(btrim(apartamento)))
  where deletado_em is null and nullif(btrim(apartamento), '') is not null;

commit;
