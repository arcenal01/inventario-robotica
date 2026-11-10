-- Teste do Bloco 15A (contagem offline): itens_para_contar_todos.
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TFA, TFB, TFX, TFP) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alA  uuid := gen_random_uuid();
  pend uuid := gen_random_uuid();
  ca uuid; cb uuid; tx uuid; tp uuid; arm uuid; p1 uuid; p2 uuid; p3 uuid;
  sensor uuid; outro uuid; cnt uuid; cnt2 uuid;
  n int; s text; t text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tf-prof@escola.local', '{"nome":"Professor TF"}'),
    (alA,  'tf-a@escola.local',    '{"nome":"Aluno TF A"}'),
    (pend, 'tf-pend@escola.local', '{"nome":"Aluno TF pendente"}');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alA;

  insert into public.categorias (nome, prefixo) values ('Teste 15 A', 'TFA') returning id into ca;
  insert into public.categorias (nome, prefixo) values ('Teste 15 B', 'TFB') returning id into cb;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TF Armário', 'TFX', 1, false) returning id into tx;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TF Posição', 'TFP', 2, true)  returning id into tp;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tx, null) returning id into arm;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (tp, arm) returning id into p3;  -- vazia
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Sensor TF', ca, 'un', 'consumivel') returning id into sensor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Outro TF', cb, 'un', 'consumivel') returning id into outro;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(sensor, p1, 5, gen_random_uuid());
  perform public.registrar_entrada(outro,  p1, 4, gen_random_uuid());
  perform public.registrar_entrada(sensor, p2, 3, gen_random_uuid());
  cnt := (public.abrir_contagem('por_endereco', arm) ->> 'contagem_id')::uuid;

  -- 1) Aluno recebe de uma vez as linhas de todas as posições (p3 vazia não tem linha)
  perform set_config('request.jwt.claims', json_build_object('sub', alA, 'role', 'authenticated')::text, true);
  select count(*), count(distinct endereco_id) into n, s from public.itens_para_contar_todos(cnt);
  if n = 3 and s = '2' then raise notice 'OK 1) 3 linhas em 2 posições';
  else raise notice 'FALHOU 1) linhas=% posições=%', n, s; end if;

  -- 2) Igual à função de uma posição (mesma situação para cada item)
  select string_agg(nome || ':' || situacao, ',' order by nome) into s from public.itens_para_contar_todos(cnt) where endereco_id = p1;
  select string_agg(nome || ':' || situacao, ',' order by nome) into t from public.itens_para_contar(cnt, p1);
  if s = t then raise notice 'OK 2) p1 igual à itens_para_contar: %', s;
  else raise notice 'FALHOU 2) todos=% uma=%', s, t; end if;

  -- 3) Depois de contar, a situação acompanha (contado), sem devolver quantidades
  perform public.registrar_contagem(cnt, p2, jsonb_build_array(jsonb_build_object('item_id', sensor, 'quantidade', 3)), gen_random_uuid());
  select situacao into s from public.itens_para_contar_todos(cnt) where endereco_id = p2 and item_id = sensor;
  if s = 'contado' then raise notice 'OK 3) p2 sensor contado';
  else raise notice 'FALHOU 3) situação %', s; end if;

  -- 4) Por categoria: só itens da categoria
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  cnt2 := (public.abrir_contagem('por_categoria', null, cb) ->> 'contagem_id')::uuid;
  select string_agg(distinct nome, ',') into s from public.itens_para_contar_todos(cnt2);
  if s = 'Outro TF' then raise notice 'OK 4) por categoria: só %', s;
  else raise notice 'FALHOU 4) itens=%', s; end if;

  -- 5) Pendente bloqueado
  perform set_config('request.jwt.claims', json_build_object('sub', pend, 'role', 'authenticated')::text, true);
  begin
    perform * from public.itens_para_contar_todos(cnt);
    raise notice 'FALHOU 5) pendente viu os itens';
  exception when others then
    raise notice 'OK 5) pendente bloqueado: %', sqlerrm;
  end;

  -- 6) Contagem inexistente
  perform set_config('request.jwt.claims', json_build_object('sub', alA, 'role', 'authenticated')::text, true);
  begin
    perform * from public.itens_para_contar_todos(gen_random_uuid());
    raise notice 'FALHOU 6) aceitou contagem inexistente';
  exception when others then
    if sqlerrm like '%não encontrada%' then raise notice 'OK 6) %', sqlerrm;
    else raise notice 'FALHOU 6) erro inesperado: %', sqlerrm; end if;
  end;
end $$;

-- 7) Sem coluna de quantidade e sem acesso anônimo
do $$
begin
  if not has_function_privilege('anon', 'public.itens_para_contar_todos(uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.itens_para_contar_todos(uuid)', 'execute')
     and pg_get_function_result('public.itens_para_contar_todos(uuid)'::regprocedure) not like '%quantidade%'
  then raise notice 'OK 7) anon sem acesso; authenticated com acesso; resultado sem quantidade';
  else raise notice 'FALHOU 7) permissões ou colunas da função'; end if;
end $$;

rollback;
