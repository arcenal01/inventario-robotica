-- Teste do Bloco 5. Tudo termina em ROLLBACK: não deixa dados no banco.
-- Cria professor e 2 alunos de teste dentro da transação e simula o login deles.
-- Se o insert em auth.users falhar na sua versão, crie os 3 usuários pelo painel
-- (Authentication > Users) e troque os gen_random_uuid() das 3 primeiras variáveis pelos ids deles.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  al1  uuid := gen_random_uuid();
  al2  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p1 uuid; p2 uuid;
  resistor uuid; multi uuid;
  r jsonb; cnt uuid; k uuid; n numeric; emp uuid; st text;
begin
  -- usuários de teste
  insert into auth.users (id, email) values
    (prof, 'prof.teste5@escola.local'),
    (al1,  'aluno1.teste5@escola.local'),
    (al2,  'aluno2.teste5@escola.local');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id in (al1, al2);

  -- dados básicos
  insert into public.categorias (nome, prefixo) values ('Teste5', 'TSC') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste5 Armário', 'TCA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste5 Posição', 'TCP', 2, true) returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p2;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Resistor 10k', c, 'un', 'consumivel') returning id into resistor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Multímetro', c, 'un', 'emprestavel') returning id into multi;

  -- estoque e um empréstimo (professor)
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(resistor, p1, 10, gen_random_uuid());
  perform public.registrar_entrada(multi, p1, 3, gen_random_uuid());
  perform public.emprestar(multi, p1, al1, 1, gen_random_uuid());   -- saldo do multímetro em p1 = 2

  -- 1) aluno não abre contagem
  perform set_config('request.jwt.claims', json_build_object('sub', al1, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_contagem('por_endereco', a);
    raise notice 'FALHOU: aluno não deveria abrir contagem';
  exception when others then
    raise notice '1) OK, aluno bloqueado: %', sqlerrm;
  end;

  -- 2) professor abre contagem do armário (inclui as 2 posições)
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  r := public.abrir_contagem('por_endereco', a, null, 'teste');
  cnt := (r->>'contagem_id')::uuid;
  raise notice '2) contagem: codigo=% enderecos=% (esperado CNT-AAAA-0001 e 2)', r->>'codigo', r->>'enderecos';

  -- 3) aluno 1 conta a posição p1: resistor 8 (sistema 10); esquece o multímetro
  perform set_config('request.jwt.claims', json_build_object('sub', al1, 'role', 'authenticated')::text, true);
  k := gen_random_uuid();
  r := public.registrar_contagem(cnt, p1, jsonb_build_array(jsonb_build_object('item_id', resistor, 'quantidade', 8)), k);
  raise notice '3) contou: registrados=% duplicada=% (esperado 1 e false)', r->>'itens_registrados', r->>'duplicada';
  r := public.registrar_contagem(cnt, p1, jsonb_build_array(jsonb_build_object('item_id', resistor, 'quantidade', 8)), k);
  raise notice '4) reenvio da mesma chave: duplicada=% (esperado true)', r->>'duplicada';
  select divergencia into n from public.contagem_itens where contagem_id = cnt and item_id = resistor;
  raise notice '   divergência=% (esperado -2)', n;
  begin
    perform public.registrar_contagem(cnt, p1, jsonb_build_array(jsonb_build_object('item_id', resistor, 'quantidade', 9)), gen_random_uuid());
    raise notice 'FALHOU: não deveria contar de novo o mesmo item';
  exception when others then
    raise notice '5) OK, item já contado: %', sqlerrm;
  end;

  -- 4) encerrar: falta a posição p2
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  begin
    perform public.encerrar_contagem(cnt);
    raise notice 'FALHOU: deveria acusar endereço sem contagem';
  exception when others then
    raise notice '6) OK, acusou endereço sem contagem: %', sqlerrm;
  end;
  r := public.encerrar_contagem(cnt, true);
  raise notice '7) encerrada: status=% sem_contagem=% divergencias=% (esperado em_revisao, 1 e 2)',
    r->>'status', r->>'enderecos_sem_contagem', r->>'divergencias';
  select nao_listado, emprestado_em_aberto into st, n from public.contagem_itens where contagem_id = cnt and item_id = multi;
  raise notice '   multímetro não listado=% emprestado_em_aberto=% (esperado true e 1)', st, n;

  -- 5) recontagem por OUTRA pessoa
  r := public.solicitar_recontagem(cnt, p1);
  raise notice '8) recontagem pedida: itens=% (esperado 2)', r->>'itens_para_recontar';
  perform set_config('request.jwt.claims', json_build_object('sub', al1, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_contagem(cnt, p1, jsonb_build_array(jsonb_build_object('item_id', resistor, 'quantidade', 8)), gen_random_uuid());
    raise notice 'FALHOU: quem contou antes não pode recontar';
  exception when others then
    raise notice '9) OK, exigiu outra pessoa: %', sqlerrm;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', al2, 'role', 'authenticated')::text, true);
  perform public.registrar_contagem(cnt, p1, jsonb_build_array(
            jsonb_build_object('item_id', resistor, 'quantidade', 8),
            jsonb_build_object('item_id', multi, 'quantidade', 2)), gen_random_uuid());
  select count(*) into n from public.vw_contagem_divergencias where contagem_id = cnt;
  raise notice '10) após recontagem, divergências atuais=% (esperado 1: só o resistor)', n;

  -- 6) professor encerra de novo e aprova; o ajuste vem da divergência
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.encerrar_contagem(cnt, true);
  perform public.registrar_entrada(resistor, p1, 5, gen_random_uuid(), 'chegou material depois da contagem');  -- saldo 15
  r := public.aprovar_contagem(cnt);
  raise notice '11) aprovada: status=% ajustes=% (esperado aprovada e 1)', r->>'status', r->>'ajustes_gerados';
  select quantidade_atual into n from public.saldos_por_endereco where item_id = resistor and endereco_id = p1;
  raise notice '    saldo do resistor=% (esperado 13 = 15 - 2: a entrada feita depois NÃO é desfeita)', n;
  select quantidade_atual into n from public.saldos_por_endereco where item_id = multi and endereco_id = p1;
  raise notice '    saldo do multímetro=% (esperado 2, sem ajuste)', n;
  select count(*) into n from public.movimentacoes where contagem_id = cnt and tipo = 'ajuste';
  raise notice '    movimentações de ajuste ligadas à contagem=% (esperado 1)', n;

  begin
    perform public.aprovar_contagem(cnt);
    raise notice 'FALHOU: não deveria aprovar duas vezes';
  exception when others then
    raise notice '12) OK, não aprova duas vezes: %', sqlerrm;
  end;

  -- 7) auditoria
  select count(*) into n from public.auditoria where tabela = 'contagens' and registro_id = cnt;
  raise notice '13) linhas de auditoria da contagem=% (esperado maior que 0)', n;
  select count(*) into n from public.auditoria where tabela = 'perfis' and registro_id = prof;
  raise notice '    linhas de auditoria do perfil do professor=% (esperado maior que 0)', n;
  begin
    update public.auditoria set acao = 'X';
    raise notice 'FALHOU: auditoria deveria ser imutável';
  exception when others then
    raise notice '14) OK, auditoria imutável: %', sqlerrm;
  end;
end $$;

rollback;
