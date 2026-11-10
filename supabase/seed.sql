-- =====================================================================
-- seed.sql: dados de TESTE (roda no `supabase db reset`)
-- ATENÇÃO: use só em desenvolvimento/homologação. NUNCA rode em produção:
-- cria usuários com senha conhecida.
-- Senha de todos os usuários de teste: Teste@12345
-- =====================================================================

-- ---------------------------------------------------------------------
-- USUÁRIOS DE TESTE
-- ---------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@escola.local',  'Admin Teste'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'prof@escola.local',   'Professor Teste'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'aluno1@escola.local', 'Aluno Um'),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'aluno2@escola.local', 'Aluno Dois'),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'aluno3@escola.local', 'Aluno Três (pendente)')
    ) as t(id, email, nome)
  loop
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, email_change, email_change_token_new, recovery_token)
    values
      ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('Teste@12345', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('nome', u.nome), now(), now(), '', '', '', '');

    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now());
  end loop;
end $$;

-- o trigger já criou os perfis como "aluno / pendente"; aqui definimos os papéis
update public.perfis set perfil = 'admin',     status_cadastro = 'aprovado' where email = 'admin@escola.local';
update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where email = 'prof@escola.local';
update public.perfis set status_cadastro = 'aprovado' where email in ('aluno1@escola.local', 'aluno2@escola.local');
-- aluno3 fica pendente de propósito (para testar a aprovação de alunos)

-- ---------------------------------------------------------------------
-- CATEGORIAS e TIPOS DE ENDEREÇO
-- ---------------------------------------------------------------------
insert into public.categorias (nome, prefixo) values
  ('Placas',       'PLA'),
  ('Sensores',     'SEN'),
  ('Motores',      'MOT'),
  ('Cabos',        'CAB'),
  ('Componentes',  'COM'),
  ('Ferramentas',  'FER');

insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values
  ('Armário',    'ARM', 1, false),
  ('Estante',    'EST', 1, false),
  ('Gaveta',     'GAV', 2, false),
  ('Prateleira', 'PRA', 2, false),
  ('Caixa',      'CX',  3, false),
  ('Posição',    'P',   4, true);

-- ---------------------------------------------------------------------
-- ENDEREÇOS, ITENS e ESTOQUE INICIAL
-- ---------------------------------------------------------------------
create function pg_temp.novo_end(p_tipo text, p_pai uuid, p_nome text)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.enderecos (tipo_endereco_id, pai_id, nome)
  values ((select id from public.tipos_endereco where prefixo = p_tipo), p_pai, p_nome)
  returning id into v;
  return v;
end $$;

create function pg_temp.novo_item(
  p_nome text, p_cat text, p_unidade public.unidade_medida,
  p_tipo public.tipo_controle, p_min numeric)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.itens (nome, categoria_id, unidade, tipo_controle, estoque_minimo)
  values (p_nome, (select id from public.categorias where prefixo = p_cat), p_unidade, p_tipo, p_min)
  returning id into v;
  return v;
end $$;

do $$
declare
  v_prof uuid := '00000000-0000-4000-8000-000000000002';
  a1 uuid; g1 uuid; g2 uuid; cx1 uuid; p11 uuid; p12 uuid; p13 uuid; p21 uuid; p22 uuid;
  a2 uuid; g3 uuid; cx2 uuid; p31 uuid; p32 uuid;
  e1 uuid; pr1 uuid; p41 uuid; p42 uuid;
begin
  -- Armário principal
  a1  := pg_temp.novo_end('ARM', null, 'Armário principal');
  g1  := pg_temp.novo_end('GAV', a1, 'Placas e sensores');
  p11 := pg_temp.novo_end('P', g1, null);
  p12 := pg_temp.novo_end('P', g1, null);
  p13 := pg_temp.novo_end('P', g1, null);
  g2  := pg_temp.novo_end('GAV', a1, 'Componentes');
  cx1 := pg_temp.novo_end('CX', g2, 'Caixa de resistores e LEDs');
  p21 := pg_temp.novo_end('P', cx1, null);
  p22 := pg_temp.novo_end('P', cx1, null);
  -- Armário de ferramentas
  a2  := pg_temp.novo_end('ARM', null, 'Armário de ferramentas');
  g3  := pg_temp.novo_end('GAV', a2, 'Ferramentas manuais');
  cx2 := pg_temp.novo_end('CX', g3, 'Caixa de ferramentas');
  p31 := pg_temp.novo_end('P', cx2, null);
  p32 := pg_temp.novo_end('P', cx2, null);
  -- Estante de cabos e motores
  e1  := pg_temp.novo_end('EST', null, 'Estante de cabos e motores');
  pr1 := pg_temp.novo_end('PRA', e1, 'Prateleira 1');
  p41 := pg_temp.novo_end('P', pr1, null);
  p42 := pg_temp.novo_end('P', pr1, null);

  -- Entradas feitas "como professor" (as funções exigem um usuário logado)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_prof, 'role', 'authenticated')::text, true);

  perform public.registrar_entrada(pg_temp.novo_item('Arduino Uno R3',               'PLA', 'un', 'emprestavel', 2),  p11, 6,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('ESP32 DevKit',                 'PLA', 'un', 'emprestavel', 2),  p12, 4,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Sensor ultrassônico HC-SR04',  'SEN', 'un', 'consumivel',  5),  p13, 20,  gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Sensor infravermelho TCRT5000','SEN', 'un', 'consumivel',  5),  p13, 3,   gen_random_uuid(), 'Estoque inicial (abaixo do mínimo)');
  perform public.registrar_entrada(pg_temp.novo_item('Servo motor SG90',             'MOT', 'un', 'consumivel',  4),  p42, 15,  gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Motor DC com caixa de redução','MOT', 'un', 'consumivel',  4),  p42, 10,  gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Cabo USB A-B',                 'CAB', 'un', 'emprestavel', 2),  p41, 8,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Jumper macho-fêmea 20 cm',     'CAB', 'un', 'consumivel',  20), p41, 150, gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Resistor 220 ohms',            'COM', 'un', 'consumivel',  50), p21, 200, gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('LED 5 mm vermelho',            'COM', 'un', 'consumivel',  30), p22, 100, gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Chave de fenda Phillips',      'FER', 'un', 'emprestavel', 1),  p31, 3,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Alicate de bico',              'FER', 'un', 'emprestavel', 1),  p31, 2,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Ferro de solda 40 W',          'FER', 'un', 'emprestavel', 1),  p32, 2,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Multímetro digital',           'FER', 'un', 'emprestavel', 1),  p32, 3,   gen_random_uuid(), 'Estoque inicial');
  perform public.registrar_entrada(pg_temp.novo_item('Estanho para solda (metros)',  'FER', 'm',  'consumivel',  5),  p32, 20,  gen_random_uuid(), 'Estoque inicial');
end $$;

-- limpa a simulação de login usada acima
select set_config('request.jwt.claims', '', false);
