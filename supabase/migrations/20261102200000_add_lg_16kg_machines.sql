begin;

update public.maquina
set
  nome = 'Lava e Seca 393 (16 kg)',
  tipo = 'lavagem'::public.maquina_tipo,
  capacidade_kg = 16,
  capacidade_secagem_kg = null,
  ciclos_por_dia_util = 6,
  ativo = true,
  deletado_em = null
where device_id = '912f1fb0c10ef28541d04efa0533edf5d8528b38af00f2429a3e8366921d7b5e';

insert into public.maquina (
  nome, tipo, capacidade_kg, capacidade_secagem_kg,
  device_id, ciclos_por_dia_util, ativo
)
select
  'Lava e Seca 393 (16 kg)', 'lavagem'::public.maquina_tipo, 16, null,
  '912f1fb0c10ef28541d04efa0533edf5d8528b38af00f2429a3e8366921d7b5e', 6, true
where not exists (
  select 1 from public.maquina
  where device_id = '912f1fb0c10ef28541d04efa0533edf5d8528b38af00f2429a3e8366921d7b5e'
);

update public.maquina
set
  nome = 'Lava e Seca 177 (16 kg)',
  tipo = 'lavagem'::public.maquina_tipo,
  capacidade_kg = 16,
  capacidade_secagem_kg = null,
  ciclos_por_dia_util = 6,
  ativo = true,
  deletado_em = null
where device_id = '416c359d858c6cbfc37c79ccab164208b06147bbe50bf61a8f6c8398b5f109ce';

insert into public.maquina (
  nome, tipo, capacidade_kg, capacidade_secagem_kg,
  device_id, ciclos_por_dia_util, ativo
)
select
  'Lava e Seca 177 (16 kg)', 'lavagem'::public.maquina_tipo, 16, null,
  '416c359d858c6cbfc37c79ccab164208b06147bbe50bf61a8f6c8398b5f109ce', 6, true
where not exists (
  select 1 from public.maquina
  where device_id = '416c359d858c6cbfc37c79ccab164208b06147bbe50bf61a8f6c8398b5f109ce'
);

commit;
