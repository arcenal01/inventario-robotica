-- Teste do Bloco 12 (telas de contagem): posicoes_da_contagem e itens_para_contar.
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TGA, TGB, TGX, TGP) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alA  uuid := gen_random_uuid();
  alB  uuid := gen_random_uuid();
  pend uuid := gen_random_uuid();
  ca uuid; cb uuid; tx uuid; tp uuid; arm uuid; p1 uuid; p2 uuid; p3 uuid; fora uuid;
  sensor uuid; multi uuid; outro uuid; cnt uuid; cnt2 uuid;
  r record; n int; s text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tg-prof@escola.local', '{"nome":"Professor TG"}'),
    (alA,  'tg-a@escola.local',    '{"nome":"Aluno TG A"}'),
    (alB,  'tg-b@escola.local',    '{"nome":"Aluno TG B"}'),
    (pend, 'tg-pend@escola.local', '{"nome":"Aluno TG pendente"}');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id in (alA, alB);

  insert into public.categorias (nome, prefixo) values ('Teste 12 A', 'TGA') returning id into ca;
  insert into public.categorias (nome, prefixo) values ('Teste 12 B', 'TGB') returning id into cb;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TG Armário', 'TGX', 1, false) returning id into tx;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TG Posição', 'TGP', 2, true)  returning id into tp;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tx, null) returning id into arm;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p3;  -- vazia
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tx, null) returning id into fora;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Sensor TG', ca, 'un', 'consumivel') returning id into sensor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Multímetro TG', ca, 'un', 'emprestavel') returning id into multi;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Outro TG', cb, 'un', 'consumivel') returning id into outro;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(sensor, p1, 5, gen_random_uuid());
  perform public.registrar_entrada(multi,  p1, 2, gen_random_uuid());
  perform public.registrar_entrada(sensor, p2, 3, gen_random_uuid());
  perform public.registrar_entrada(outro,  p1, 4, gen_random_uuid());
  cnt := (public.abrir_contagem('por_endereco', arm) ->> 'contagem_id')::uuid;

  -- 1) Aluno vê as 3 posições; p1 tem 3 itens a contar, p3 está vazia
  perform set_config('request.jwt.claims', json_build_object('sub', alA, 'role', 'authenticated')::text, true);
  select count(*) into n from public.posicoes_da_contagem(cnt);
  select * into r from public.posicoes_da_contagem(cnt) where endereco_id = p1;
  if n = 3 and r.itens_faltando = 3 and r.sem_contagem and r.itens_contados = 0
     and (select itens_faltando from public.posicoes_da_contagem(cnt) where endereco_id = p3) = 0
  then raise notice 'OK 1) 3 posições; p1 com 3 itens a contar; p3 vazia';
  else raise notice 'FALHOU 1) n=% p1=%', n, r; end if;

  -- 2) Itens de p1: todos "contar"
  select string_agg(nome || ':' || situacao, ',' order by nome) into s from public.itens_para_contar(cnt, p1);
  if s = 'Multímetro TG:contar,Outro TG:contar,Sensor TG:contar' then raise notice 'OK 2) p1: %', s;
  else raise notice 'FALHOU 2) p1: %', s; end if;

  -- 3) Aluno A conta só o sensor em p1: p1 fica parcial e "contada por mim" só para A
  perform public.registrar_contagem(cnt, p1, jsonb_build_array(jsonb_build_object('item_id', sensor, 'quantidade', 5)), gen_random_uuid());
  select * into r from public.posicoes_da_contagem(cnt) where endereco_id = p1;
  if r.itens_contados = 1 and r.itens_faltando = 2 and not r.sem_contagem and r.contada_por_mim
  then raise notice 'OK 3) p1 parcial (1 contado, 2 faltando), contada por A';
  else raise notice 'FALHOU 3) p1=%', r; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', alB, 'role', 'authenticated')::text, true);
  select * into r from public.posicoes_da_contagem(cnt) where endereco_id = p1;
  if not r.contada_por_mim then raise notice 'OK 4) para B a p1 não foi "contada por mim"';
  else raise notice 'FALHOU 4) p1=%', r; end if;

  -- 5) B vê o sensor como "contado" (sem quantidade) e o resto para contar
  select string_agg(nome || ':' || situacao, ',' order by nome) into s from public.itens_para_contar(cnt, p1);
  if s = 'Multímetro TG:contar,Outro TG:contar,Sensor TG:contado' then raise notice 'OK 5) p1 para B: %', s;
  else raise notice 'FALHOU 5) p1 para B: %', s; end if;

  -- 6) Item achado a mais (sem saldo) aparece na lista da posição depois de contado
  perform public.registrar_contagem(cnt, p2, jsonb_build_array(
    jsonb_build_object('item_id', sensor, 'quantidade', 2),
    jsonb_build_object('item_id', multi,  'quantidade', 1)), gen_random_uuid());
  select string_agg(nome || ':' || situacao, ',' order by nome) into s from public.itens_para_contar(cnt, p2);
  if s = 'Multímetro TG:contado,Sensor TG:contado' then raise notice 'OK 6) p2 com item achado a mais: %', s;
  else raise notice 'FALHOU 6) p2: %', s; end if;

  -- 7) Endereço fora da contagem
  begin
    perform * from public.itens_para_contar(cnt, fora);
    raise notice 'FALHOU 7) aceitou endereço fora da contagem';
  exception when others then
    if sqlerrm like '%não faz parte%' then raise notice 'OK 7) fora da contagem: %', sqlerrm;
    else raise notice 'FALHOU 7) erro inesperado: %', sqlerrm; end if;
  end;

  -- 8) Usuário pendente não usa as funções
  perform set_config('request.jwt.claims', json_build_object('sub', pend, 'role', 'authenticated')::text, true);
  begin
    perform * from public.posicoes_da_contagem(cnt);
    raise notice 'FALHOU 8) pendente viu as posições';
  exception when others then
    raise notice 'OK 8) pendente bloqueado: %', sqlerrm;
  end;

  -- 9) Encerrar (forçando: p3 vazia) + recontagem: quem contou não reconta
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.encerrar_contagem(cnt, true);
  perform public.solicitar_recontagem(cnt, p2, sensor);
  select * into r from public.posicoes_da_contagem(cnt) where endereco_id = p1;
  select recontagens into n from public.posicoes_da_contagem(cnt) where endereco_id = p2;
  if r.itens_faltando = 0 and r.itens_contados = 1 and n = 1
  then raise notice 'OK 9) encerrada: p1 sem faltas (não listados), p2 com 1 recontagem';
  else raise notice 'FALHOU 9) p1=% recontagens p2=%', r, n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', alB, 'role', 'authenticated')::text, true);
  select situacao into s from public.itens_para_contar(cnt, p2) where item_id = sensor;
  if s = 'recontar_outro' then raise notice 'OK 10) B (que contou) vê recontar_outro';
  else raise notice 'FALHOU 10) B vê %', s; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', alA, 'role', 'authenticated')::text, true);
  select situacao into s from public.itens_para_contar(cnt, p2) where item_id = sensor;
  if s = 'recontar' then raise notice 'OK 11) A vê recontar';
  else raise notice 'FALHOU 11) A vê %', s; end if;

  -- 12) Por categoria: só itens da categoria aparecem
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  cnt2 := (public.abrir_contagem('por_categoria', null, cb) ->> 'contagem_id')::uuid;
  select string_agg(nome, ',') into s from public.itens_para_contar(cnt2, p1);
  select itens_faltando into n from public.posicoes_da_contagem(cnt2) where endereco_id = p1;
  if s = 'Outro TG' and n = 1 then raise notice 'OK 12) por categoria: p1 só com %', s;
  else raise notice 'FALHOU 12) itens=% faltando=%', s, n; end if;
end $$;

-- 13) Anônimo não executa as funções
do $$
begin
  if not has_function_privilege('anon', 'public.posicoes_da_contagem(uuid)', 'execute')
     and not has_function_privilege('anon', 'public.itens_para_contar(uuid, uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.itens_para_contar(uuid, uuid)', 'execute')
  then raise notice 'OK 13) anon sem acesso; authenticated com acesso';
  else raise notice 'FALHOU 13) permissões das funções'; end if;
end $$;

rollback;
