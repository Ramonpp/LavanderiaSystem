begin;

insert into public.tipo_peca (nome, descricao, peso_referencia_kg)
values
  ('Lençol', null, null),
  ('Fronha', null, null),
  ('Capa de travesseiro', null, null),
  ('Toalha de piso', null, null),
  ('Toalha de rosto', null, null),
  ('Toalha de banho', null, null),
  ('Roupão', null, null),
  ('Cobertor', null, null),
  ('Edredom', null, null),
  ('Colcha', null, null),
  ('Cobre-leito', null, null),
  ('Manta', null, null),
  ('Cortina', null, null),
  ('Tapete', null, null)
on conflict (nome) do nothing;

commit;

