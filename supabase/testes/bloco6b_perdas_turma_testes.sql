-- Teste da migration 0007 (perda idempotente + turma no cadastro).
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TPD, TPA, TPP) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  alu2 uuid := gen_random_uuid();
  sem  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p uuid; multi uuid;
  r jsonb; emp uuid; k uuid; n numeric; v text;
begin
  -- 1) Turma no cadastro: vem dos metadados; espaços somem; vazio vira nulo
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tpd-prof@escola.local',   '{"nome":"Professor TPD"}'),
    (alu,  'tpd-aluno@escola.local',  '{"nome":"Aluno TPD","turma":"  2º A  "}'),
    (alu2, 'tpd-aluno2@escola.local', '{"nome":"Aluno Dois TPD","turma":"   "}'),
    (sem,  'tpd-sem@escola.local',    '{"nome":"Sem Turma TPD"}');

  select turma into v from public.perfis where id = alu;
  if v = '2º A' then raise notice 'OK 1) turma gravada: [%]', v;
  else raise notice 'FALHOU 1) esperado [2º A], veio [%]', v; end if;

  select turma into v from public.perfis where id = alu2;
  if v is null then raise notice 'OK 2) turma só com espaços vira nula';
  else raise notice 'FALHOU 2) esperado nulo, veio [%]', v; end if;

  select turma into v from public.perfis where id = sem;
  if v is null then raise notice 'OK 3) cadastro sem turma continua funcionando';
  else raise notice 'FALHOU 3) esperado nulo, veio [%]', v; end if;

  -- Prepara (como postgres): professor aprovado, aluno aprovado, item emprestável com saldo
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id in (alu, alu2);
  insert into public.categorias (nome, prefixo) values ('Teste Perdas', 'TPD') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TPD Armário', 'TPA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TPD Posição', 'TPP', 2, true)  returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Multímetro TPD', c, 'un', 'emprestavel') returning id into multi;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(multi, p, 5, gen_random_uuid());
  r := public.emprestar(multi, p, alu, 3, gen_random_uuid());
  emp := (r->>'emprestimo_id')::uuid;

  -- 4) Sem chave: recusa
  begin
    perform public.marcar_emprestimo_perdido(emp, 1, 'caiu', null);
    raise notice 'FALHOU 4) aceitou perda sem chave';
  exception when others then
    raise notice 'OK 4) exige chave: %', sqlerrm;
  end;

  -- 5) Perda com chave + reenvio da mesma chave (simula o celular reenviando)
  k := gen_random_uuid();
  r := public.marcar_emprestimo_perdido(emp, 1, 'caiu da bancada', k);
  if r->>'duplicada' = 'false' and r->>'status' = 'em_aberto' then raise notice 'OK 5) perda registrada: status=%', r->>'status';
  else raise notice 'FALHOU 5) resposta inesperada: %', r; end if;

  r := public.marcar_emprestimo_perdido(emp, 1, 'caiu da bancada', k);
  select quantidade_perdida into n from public.emprestimos where id = emp;
  if r->>'duplicada' = 'true' and n = 1 then raise notice 'OK 6) reenvio não duplicou: perdida=%', n;
  else raise notice 'FALHOU 6) duplicada=% perdida=% (esperado true e 1)', r->>'duplicada', n; end if;

  select count(*) into n from public.emprestimo_perdas where emprestimo_id = emp;
  if n = 1 then raise notice 'OK 7) uma linha em emprestimo_perdas';
  else raise notice 'FALHOU 7) esperado 1 linha, veio %', n; end if;

  -- 8) Mesma chave em outro empréstimo: recusa
  r := public.emprestar(multi, p, alu2, 1, gen_random_uuid());
  begin
    perform public.marcar_emprestimo_perdido((r->>'emprestimo_id')::uuid, 1, 'outro', k);
    raise notice 'FALHOU 8) aceitou chave repetida em outro empréstimo';
  exception when others then
    raise notice 'OK 8) chave repetida em outro empréstimo: %', sqlerrm;
  end;

  -- 9) Perda do restante (quantidade nula = tudo que falta) encerra como perdido
  r := public.marcar_emprestimo_perdido(emp, null, 'sumiu', gen_random_uuid());
  if r->>'status' = 'perdido' then raise notice 'OK 9) restante perdido: status=%', r->>'status';
  else raise notice 'FALHOU 9) esperado perdido, veio %', r->>'status'; end if;

  -- 10) Aluno não marca perda
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  begin
    perform public.marcar_emprestimo_perdido(emp, 1, 'x', gen_random_uuid());
    raise notice 'FALHOU 10) aluno marcou perda';
  exception when others then
    raise notice 'OK 10) aluno sem permissão: %', sqlerrm;
  end;
end $$;

-- 11) Aluno vê as perdas dos próprios empréstimos (pelo RLS, como a API faz)
do $$
declare v_alu uuid; n int;
begin
  select id into v_alu from public.perfis where email = 'tpd-aluno@escola.local';
  perform set_config('request.jwt.claims', json_build_object('sub', v_alu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.emprestimo_perdas;
  reset role;
  if n = 2 then raise notice 'OK 11) aluno vê as 2 perdas do próprio empréstimo';
  else raise notice 'FALHOU 11) esperado 2, aluno viu %', n; end if;
end $$;

-- 12) Histórico de perdas é imutável
do $$
begin
  update public.emprestimo_perdas set quantidade = 99;
  raise notice 'FALHOU 12) perda alterada';
exception when others then
  raise notice 'OK 12) perda imutável: %', sqlerrm;
end $$;

rollback;
