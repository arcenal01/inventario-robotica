-- Teste do Bloco 3. Tudo termina em ROLLBACK: não deixa dados no banco.
-- Cria 2 usuários de teste (professor e aluno) dentro da transação e simula o login deles.
-- Se o insert em auth.users falhar na sua versão, crie os 2 usuários pelo painel
-- (Authentication > Users) e troque os dois gen_random_uuid() pelos ids deles.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p1 uuid; p2 uuid;
  resistor uuid; multi uuid; fio uuid;
  r jsonb; emp uuid; n numeric; s text; k uuid;
begin
  -- usuários de teste
  insert into auth.users (id, email) values
    (prof, 'prof.teste@escola.local'), (alu, 'aluno.teste@escola.local');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alu;

  -- dados básicos
  insert into public.categorias (nome, prefixo) values ('Teste', 'TST') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste Armário', 'TARM', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste Posição', 'TPOS', 2, true) returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p2;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Resistor 10k', c, 'un', 'consumivel') returning id into resistor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Multímetro', c, 'un', 'emprestavel') returning id into multi;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Fio', c, 'm', 'consumivel') returning id into fio;

  -- login como professor
  perform set_config('request.jwt.claims',
    json_build_object('sub', prof, 'role', 'authenticated')::text, true);

  -- 1) entrada + idempotência
  k := gen_random_uuid();
  r := public.registrar_entrada(resistor, p1, 10, k, 'teste');
  raise notice '1) entrada: duplicada=% (esperado false)', r->>'duplicada';
  r := public.registrar_entrada(resistor, p1, 10, k, 'teste');
  raise notice '2) reenvio mesma chave: duplicada=% (esperado true)', r->>'duplicada';
  select quantidade_atual into n from public.saldos_por_endereco where item_id = resistor and endereco_id = p1;
  raise notice '   saldo=% (esperado 10, sem duplicar)', n;

  -- 2) saída e saldo negativo
  perform public.registrar_saida(resistor, p1, 3, gen_random_uuid(), 'consumo');
  select quantidade_atual into n from public.saldos_por_endereco where item_id = resistor and endereco_id = p1;
  raise notice '3) saída de 3: saldo=% (esperado 7)', n;
  begin
    perform public.registrar_saida(resistor, p1, 100, gen_random_uuid(), 'x');
    raise notice 'FALHOU: deveria bloquear saldo negativo';
  exception when others then
    raise notice '4) OK, bloqueou saldo negativo: %', sqlerrm;
  end;

  -- 3) transferência
  perform public.transferir(resistor, p1, p2, 2, gen_random_uuid(), 'organizar');
  select quantidade_atual into n from public.saldos_por_endereco where item_id = resistor and endereco_id = p1;
  raise notice '5) transferência de 2: origem=% (esperado 5)', n;
  select quantidade_atual into n from public.saldos_por_endereco where item_id = resistor and endereco_id = p2;
  raise notice '   destino=% (esperado 2)', n;

  -- 4) ajuste
  r := public.ajustar(resistor, p1, 4, 'contagem física', gen_random_uuid());
  raise notice '6) ajuste: anterior=% novo=% (esperado 5 e 4)', r->>'saldo_anterior', r->>'saldo_novo';
  begin
    perform public.ajustar(resistor, p1, 9, '   ', gen_random_uuid());
    raise notice 'FALHOU: deveria exigir motivo';
  exception when others then
    raise notice '7) OK, exigiu motivo: %', sqlerrm;
  end;

  -- 5) quantidade inteira para "un"
  begin
    perform public.registrar_entrada(resistor, p1, 1.5, gen_random_uuid());
    raise notice 'FALHOU: "un" não aceita fração';
  exception when others then
    raise notice '8) OK, bloqueou fração em "un": %', sqlerrm;
  end;
  perform public.registrar_entrada(fio, p1, 2.5, gen_random_uuid());
  raise notice '   fio em metros aceita 2.5: OK';

  -- 6) empréstimo
  perform public.registrar_entrada(multi, p1, 3, gen_random_uuid());
  begin
    perform public.emprestar(resistor, p1, alu, 1, gen_random_uuid());
    raise notice 'FALHOU: consumível não pode ser emprestado';
  exception when others then
    raise notice '9) OK, bloqueou empréstimo de consumível: %', sqlerrm;
  end;
  begin
    perform public.registrar_saida(multi, p1, 1, gen_random_uuid());
    raise notice 'FALHOU: emprestável não tem saída definitiva';
  exception when others then
    raise notice '10) OK, bloqueou saída de emprestável: %', sqlerrm;
  end;

  r := public.emprestar(multi, p1, alu, 2, gen_random_uuid(), null, 'aula de robótica');
  emp := (r->>'emprestimo_id')::uuid;
  select quantidade_atual into n from public.saldos_por_endereco where item_id = multi and endereco_id = p1;
  raise notice '11) emprestou 2 (sem prazo): saldo=% (esperado 1)', n;

  -- deixa o prazo vencido para testar a view de atrasados (como dono do banco)
  update public.emprestimos set prazo_previsto = public.hoje_br() - 3 where id = emp;
  select count(*) into n from public.vw_emprestimos_atrasados where id = emp;
  raise notice '12) aparece em atrasados: % (esperado 1)', n;

  -- 7) devolução parcial, perda e encerramento
  r := public.devolver(emp, 1, p2, gen_random_uuid());
  raise notice '13) devolveu 1: status=% (esperado devolvido_parcial)', r->>'status';
  select quantidade_atual into n from public.saldos_por_endereco where item_id = multi and endereco_id = p2;
  raise notice '    saldo em p2=% (esperado 1)', n;
  begin
    perform public.devolver(emp, 5, p2, gen_random_uuid());
    raise notice 'FALHOU: devolveu mais que o pendente';
  exception when others then
    raise notice '14) OK, bloqueou devolução maior que o pendente: %', sqlerrm;
  end;
  r := public.marcar_emprestimo_perdido(emp, 1, 'quebrou na aula', gen_random_uuid());  -- chave desde a 0007
  raise notice '15) marcou 1 como perdido: status=% (esperado devolvido)', r->>'status';
  begin
    perform public.devolver(emp, 1, p2, gen_random_uuid());
    raise notice 'FALHOU: empréstimo já encerrado';
  exception when others then
    raise notice '16) OK, empréstimo encerrado: %', sqlerrm;
  end;

  -- 8) ledger imutável
  begin
    update public.movimentacoes set quantidade = 999;
    raise notice 'FALHOU: ledger deveria ser imutável';
  exception when others then
    raise notice '17) OK, ledger imutável: %', sqlerrm;
  end;

  -- 9) aluno não pode movimentar
  perform set_config('request.jwt.claims',
    json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_entrada(resistor, p1, 1, gen_random_uuid());
    raise notice 'FALHOU: aluno não deveria movimentar estoque';
  exception when others then
    raise notice '18) OK, aluno bloqueado: %', sqlerrm;
  end;
end $$;

rollback;
