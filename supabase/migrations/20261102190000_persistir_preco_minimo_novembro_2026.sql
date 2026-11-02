begin;

-- Persiste o preço mínimo nos pedidos antigos de novembro/2026 para que
-- versões do frontend anteriores à regra também exibam R$ 40,00.
with calculos as (
  select
    p.id,
    coalesce(p.adicional_pecas, 0) as adicional,
    coalesce(p.desconto_valor, 0) as desconto,
    p.desconto_tipo,
    greatest(
      0,
      ((case
        when p.preco_fixo is not null then p.preco_fixo
        else p.peso_kg * coalesce(p.preco_por_kg, 0)
      end) + coalesce(p.adicional_pecas, 0)) -
      (case
        when p.desconto_tipo = 'percentual' then
          ((case
            when p.preco_fixo is not null then p.preco_fixo
            else p.peso_kg * coalesce(p.preco_por_kg, 0)
          end) + coalesce(p.adicional_pecas, 0)) * coalesce(p.desconto_valor, 0) / 100
        when p.desconto_tipo = 'fixo' then coalesce(p.desconto_valor, 0)
        else 0
      end)
    ) as total_liquido
  from public.pedido p
  where p.data_pedido >= date '2026-11-01'
    and p.data_pedido < date '2026-12-01'
    and p.deletado_em is null
    and p.status <> 'cancelado'
), candidatos as (
  select
    c.id,
    case
      when c.desconto_tipo = 'percentual' and c.desconto >= 100 then
        greatest(0, 40 - c.adicional)
      when c.desconto_tipo = 'percentual' then
        greatest(0, (40 / (1 - c.desconto / 100)) - c.adicional)
      when c.desconto_tipo = 'fixo' then
        greatest(0, 40 + c.desconto - c.adicional)
      else
        greatest(0, 40 - c.adicional)
    end as novo_preco_fixo,
    c.desconto_tipo = 'percentual' and c.desconto >= 100 as remover_desconto_total
  from calculos c
  where c.total_liquido < 40
)
update public.pedido p
set
  preco_fixo = c.novo_preco_fixo,
  desconto_valor = case when c.remover_desconto_total then 0 else p.desconto_valor end
from candidatos c
where p.id = c.id;

-- Recalcula o status de pagamento após persistir o mínimo.
with totais as (
  select
    p.id,
    greatest(
      40,
      greatest(
        0,
        ((case
          when p.preco_fixo is not null then p.preco_fixo
          else p.peso_kg * coalesce(p.preco_por_kg, 0)
        end) + coalesce(p.adicional_pecas, 0)) -
        (case
          when p.desconto_tipo = 'percentual' then
            ((case
              when p.preco_fixo is not null then p.preco_fixo
              else p.peso_kg * coalesce(p.preco_por_kg, 0)
            end) + coalesce(p.adicional_pecas, 0)) * coalesce(p.desconto_valor, 0) / 100
          when p.desconto_tipo = 'fixo' then coalesce(p.desconto_valor, 0)
          else 0
        end)
      )
    ) as total_pedido,
    coalesce(sum(pg.valor) filter (where pg.estornado_em is null), 0) as total_pago
  from public.pedido p
  left join public.pagamento pg on pg.pedido_id = p.id
  where p.data_pedido >= date '2026-11-01'
    and p.data_pedido < date '2026-12-01'
    and p.deletado_em is null
    and p.status <> 'cancelado'
  group by p.id
)
update public.pedido p
set pagamento_status = case
  when t.total_pago >= t.total_pedido then 'pago'::public.pedido_pagamento_status
  when t.total_pago > 0 then 'em_andamento'::public.pedido_pagamento_status
  else 'devendo'::public.pedido_pagamento_status
end
from totais t
where p.id = t.id;

commit;
