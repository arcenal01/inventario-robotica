-- Teste do Bloco 8B (itens): view de estoque, proteções do item e permissões das fotos.
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TIB, TIA, TIP) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p1 uuid; p2 uuid;
  sensor uuid; multi uuid; novo uuid;
  r record; n numeric; v text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tib-prof@escola.local', '{"nome":"Professor TIB"}'),
    (alu,  'tib-aluno@escola.local', '{"nome":"Aluno TIB"}');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alu;

  insert into public.categorias (nome, prefixo) values ('Teste 8B', 'TIB') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TIB Armário', 'TIA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TIB Posição', 'TIP', 2, true)  returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p2;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle, estoque_minimo)
    values ('Sensor TIB', c, 'un', 'consumivel', 10) returning id into sensor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle, estoque_minimo)
    values ('Multímetro TIB', c, 'un', 'emprestavel', 1) returning id into multi;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle)
    values ('Item novo TIB', c, 'un', 'consumivel') returning id into novo;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(sensor, p1, 4, gen_random_uuid());
  perform public.registrar_entrada(sensor, p2, 3, gen_random_uuid());
  perform public.registrar_entrada(multi,  p1, 3, gen_random_uuid());
  perform public.emprestar(multi, p1, alu, 2, gen_random_uuid());

  -- 1) View: saldo somado dos endereços, quantos endereços e abaixo do mínimo
  select * into r from public.vw_itens_estoque where id = sensor;
  if r.saldo_total = 7 and r.enderecos_com_saldo = 2 and r.abaixo_minimo and r.categoria_prefixo = 'TIB'
  then raise notice 'OK 1) sensor: saldo=% em % endereços, abaixo do mínimo', r.saldo_total, r.enderecos_com_saldo;
  else raise notice 'FALHOU 1) sensor: saldo=% enderecos=% abaixo=% prefixo=%', r.saldo_total, r.enderecos_com_saldo, r.abaixo_minimo, r.categoria_prefixo; end if;

  -- 2) Emprestado sai do saldo e aparece em emprestado_em_aberto
  select * into r from public.vw_itens_estoque where id = multi;
  if r.saldo_total = 1 and r.emprestado_em_aberto = 2 and not r.abaixo_minimo
  then raise notice 'OK 2) multímetro: saldo=% emprestado=%', r.saldo_total, r.emprestado_em_aberto;
  else raise notice 'FALHOU 2) multímetro: saldo=% emprestado=% abaixo=%', r.saldo_total, r.emprestado_em_aberto, r.abaixo_minimo; end if;

  -- 3) Item sem saldo e sem mínimo: saldo 0 e não fica "abaixo do mínimo"
  select * into r from public.vw_itens_estoque where id = novo;
  if r.saldo_total = 0 and not r.abaixo_minimo then raise notice 'OK 3) item novo: saldo 0, sem alerta';
  else raise notice 'FALHOU 3) item novo: saldo=% abaixo=%', r.saldo_total, r.abaixo_minimo; end if;

  -- 4) Com histórico, unidade e tipo de controle não mudam
  begin
    update public.itens set unidade = 'm' where id = sensor;
    raise notice 'FALHOU 4) mudou a unidade de item com histórico';
  exception when others then
    raise notice 'OK 4) unidade bloqueada: %', sqlerrm;
  end;
  begin
    update public.itens set tipo_controle = 'emprestavel' where id = sensor;
    raise notice 'FALHOU 5) mudou o tipo de controle de item com histórico';
  exception when others then
    raise notice 'OK 5) tipo de controle bloqueado: %', sqlerrm;
  end;

  -- 6) Sem histórico pode corrigir; nome e mínimo sempre podem mudar
  update public.itens set unidade = 'm', tipo_controle = 'emprestavel' where id = novo;
  update public.itens set nome = 'Sensor TIB v2', estoque_minimo = 12 where id = sensor;
  select unidade::text into v from public.itens where id = novo;
  select estoque_minimo into n from public.itens where id = sensor;
  if v = 'm' and n = 12 then raise notice 'OK 6) correção sem histórico e edição de nome/mínimo funcionam';
  else raise notice 'FALHOU 6) unidade=% minimo=%', v, n; end if;

  -- 7) "un" não aceita mínimo quebrado
  begin
    update public.itens set estoque_minimo = 2.5 where id = sensor;
    raise notice 'FALHOU 7) aceitou mínimo 2,5 em "un"';
  exception when others then
    raise notice 'OK 7) mínimo inteiro em "un": %', sqlerrm;
  end;
end $$;

-- 8) Fotos: professor envia, aluno não envia mas vê (pelo RLS do Storage)
do $$
declare v_prof uuid; v_alu uuid; n int;
begin
  select id into v_prof from public.perfis where email = 'tib-prof@escola.local';
  select id into v_alu  from public.perfis where email = 'tib-aluno@escola.local';

  perform set_config('request.jwt.claims', json_build_object('sub', v_prof, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('itens-fotos', 'teste-tib/foto.jpg');
  reset role;
  raise notice 'OK 8) professor enviou foto';

  perform set_config('request.jwt.claims', json_build_object('sub', v_alu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('itens-fotos', 'teste-tib/aluno.jpg');
    reset role;
    raise notice 'FALHOU 9) aluno enviou foto';
  exception when others then
    reset role;
    raise notice 'OK 9) aluno não envia foto: %', sqlerrm;
  end;

  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'itens-fotos' and name like 'teste-tib/%';
  reset role;
  if n = 1 then raise notice 'OK 10) aluno vê a foto';
  else raise notice 'FALHOU 10) aluno viu % fotos (esperado 1)', n; end if;
end $$;

-- 11) Bucket configurado: público, até 2 MB, só imagens
do $$
declare r record;
begin
  select public, file_size_limit, allowed_mime_types into r from storage.buckets where id = 'itens-fotos';
  if r.public and r.file_size_limit = 2097152 and 'image/jpeg' = any(r.allowed_mime_types)
  then raise notice 'OK 11) bucket itens-fotos: público, 2 MB, imagens';
  else raise notice 'FALHOU 11) bucket: %', r; end if;
end $$;

rollback;
