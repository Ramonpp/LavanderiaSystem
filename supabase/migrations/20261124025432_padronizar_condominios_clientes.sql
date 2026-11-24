-- Consolida variações de maiúsculas, minúsculas e espaços nos condomínios conhecidos.
update public.cliente
set condominio = case
  when regexp_replace(lower(btrim(condominio)), '[^a-z0-9]+', '', 'g') = 'praiadosanjos' then 'Praia dos Anjos'
  when regexp_replace(lower(btrim(condominio)), '[^a-z0-9]+', '', 'g') = 'beachtower' then 'Beach Tower'
  when regexp_replace(lower(btrim(condominio)), '[^a-z0-9]+', '', 'g') in ('golden', 'goldenlake') then 'Golden Lake'
  when regexp_replace(lower(btrim(condominio)), '[^a-z0-9]+', '', 'g') in ('sand', 'sandbeach') then 'SAND'
  when btrim(condominio) = '' then null
  else btrim(condominio)
end
where condominio is not null;

-- Pela regra operacional, blocos numéricos acima de 4 pertencem ao Golden Lake
-- quando o cliente ainda não tem condomínio informado.
update public.cliente
set condominio = 'Golden Lake'
where (condominio is null or btrim(condominio) = '')
  and substring(bloco from '[0-9]+') is not null
  and substring(bloco from '[0-9]+')::integer > 4;
