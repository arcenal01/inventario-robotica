-- Teste do Bloco 4. Tudo termina em ROLLBACK: não deixa dados no banco.
-- Cria professor e aluno de teste dentro da transação e simula o login deles.
-- Se o insert em auth.users falhar na sua versão, crie os 2 usuários pelo painel
-- (Authentication > Users) e troque os dois gen_random_uuid() pelos ids deles.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p1 uuid; p2 uuid;
  resistor uuid; multi uuid;
  r jsonb; ped uuid; rom uuid; emp uuid; k uuid; kent uuid;
  n numeric; st text; q jsonb; ri uuid;
begin
  -- usuários de teste
  insert into auth.users (id, email) values
    (prof, 'prof.teste4@escola.local'), (alu, 'aluno.teste4@escola.local');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alu;

  -- dados básicos
  insert into public.categorias (nome, prefixo) values ('Teste4', 'TSQ') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste4 Armário', 'TQA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste4 Posição', 'TQP', 2, true) returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p1;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p2;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Resistor 10k', c, 'un', 'consumivel') returning id into resistor;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Multímetro', c, 'un', 'emprestavel') returning id into multi;

  -- estoque (professor)
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(resistor, p1, 4, gen_random_uuid());
  perform public.registrar_entrada(resistor, p2, 6, gen_random_uuid());
  perform public.registrar_entrada(multi, p1, 3, gen_random_uuid());

  -- 1) aluno cria e envia pedido
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  k := gen_random_uuid();
  q := jsonb_build_array(
        jsonb_build_object('item_id', resistor, 'quantidade', 5),
        jsonb_build_object('item_id', multi, 'quantidade', 1));
  r := public.salvar_pedido(k, 'Projeto de robô seguidor', q, '3º ano A', true);
  ped := (r->>'pedido_id')::uuid;
  raise notice '1) pedido criado: codigo=% status=% (esperado PED-AAAA-0001 e enviado)', r->>'codigo', r->>'status';
  r := public.salvar_pedido(k, 'Projeto de robô seguidor', q, '3º ano A', true);
  raise notice '2) reenvio da mesma chave: duplicada=% (esperado true)', r->>'duplicada';
  select count(*) into n from public.pedidos where solicitante_id = alu;
  raise notice '   pedidos do aluno=% (esperado 1)', n;

  -- 2) aluno não aprova
  begin
    perform public.decidir_pedido(ped, true);
    raise notice 'FALHOU: aluno não deveria aprovar';
  exception when others then
    raise notice '3) OK, aluno bloqueado: %', sqlerrm;
  end;

  -- 3) professor aprova reduzindo o resistor para 2
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  select jsonb_build_array(jsonb_build_object('pedido_item_id', pit.id, 'quantidade', 2)) into q
    from public.pedido_itens pit where pit.pedido_id = ped and pit.item_id = resistor;
  r := public.decidir_pedido(ped, true, 'ok, mas só 2', q);
  raise notice '4) aprovado: status=% (esperado aprovado)', r->>'status';
  select quantidade_aprovada into n from public.pedido_itens where pedido_id = ped and item_id = resistor;
  raise notice '   resistor aprovado=% (esperado 2)', n;

  -- 4) gerar romaneio
  r := public.gerar_romaneio_do_pedido(ped, public.hoje_br() + 7);
  rom := (r->>'romaneio_id')::uuid;
  raise notice '5) romaneio: codigo=% (esperado ROM-AAAA-0001)', r->>'codigo';
  select count(*) into n from public.romaneio_itens where romaneio_id = rom;
  raise notice '   linhas no romaneio=% (esperado 2)', n;
  begin
    perform public.gerar_romaneio_do_pedido(ped);
    raise notice 'FALHOU: não deveria gerar 2º romaneio';
  exception when others then
    raise notice '6) OK, bloqueou 2º romaneio: %', sqlerrm;
  end;

  -- 5) entregar sem separar
  kent := gen_random_uuid();
  begin
    perform public.entregar_romaneio(rom, alu, kent);
    raise notice 'FALHOU: entregou sem separar';
  exception when others then
    raise notice '7) OK, exigiu separação: %', sqlerrm;
  end;

  -- 6) separar tudo e concluir separação
  begin
    perform public.concluir_separacao(rom);
    raise notice 'FALHOU: concluiu com itens sem separar';
  exception when others then
    raise notice '8) OK, exigiu checklist completo: %', sqlerrm;
  end;
  for ri in select id from public.romaneio_itens where romaneio_id = rom loop
    perform public.marcar_item_separado(ri);
  end loop;
  perform public.concluir_separacao(rom);
  select status into st from public.pedidos where id = ped;
  raise notice '9) após separar: pedido=% (esperado separado)', st;

  -- 7) entrega: baixa do consumível + empréstimo do emprestável
  r := public.entregar_romaneio(rom, alu, kent);
  raise notice '10) entregue: status=% emprestimos_criados=% (esperado entregue e true)', r->>'status', r->>'emprestimos_criados';
  select coalesce(sum(quantidade_atual), 0) into n from public.saldos_por_endereco where item_id = resistor;
  raise notice '    saldo total de resistor=% (esperado 8 = 10 - 2)', n;
  select coalesce(sum(quantidade_atual), 0) into n from public.saldos_por_endereco where item_id = multi;
  raise notice '    saldo de multímetro=% (esperado 2 = 3 - 1)', n;
  select status into st from public.pedidos where id = ped;
  raise notice '    pedido=% (esperado entregue, pois há empréstimo)', st;

  r := public.entregar_romaneio(rom, alu, kent);
  raise notice '11) reenvio da entrega: duplicada=% (esperado true)', r->>'duplicada';
  select coalesce(sum(quantidade_atual), 0) into n from public.saldos_por_endereco where item_id = resistor;
  raise notice '    saldo de resistor continua=% (esperado 8, sem baixar de novo)', n;

  -- 8) concluir só depois de devolver
  begin
    perform public.concluir_pedido(ped);
    raise notice 'FALHOU: concluiu com empréstimo em aberto';
  exception when others then
    raise notice '12) OK, bloqueou conclusão: %', sqlerrm;
  end;
  select id into emp from public.emprestimos where emprestado_para = alu and item_id = multi;
  perform public.devolver(emp, 1, p1, gen_random_uuid());
  r := public.concluir_pedido(ped);
  raise notice '13) após devolver: status=% (esperado concluido)', r->>'status';

  -- 9) histórico e notificações
  select count(*) into n from public.pedido_historico where pedido_id = ped;
  raise notice '14) linhas de histórico=% (esperado 6: rascunho, enviado, aprovado, separado, entregue, concluido)', n;
  select count(*) into n from public.notificacoes where usuario_id = alu;
  raise notice '15) notificações do aluno=% (esperado 3: aprovado, separado, entregue)', n;
  select count(*) into n from public.notificacoes where usuario_id = prof;
  raise notice '    notificações do professor=% (esperado 1: novo pedido)', n;

  -- 10) pedido maior que o estoque não gera romaneio
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  r := public.salvar_pedido(gen_random_uuid(), 'Pedido grande', jsonb_build_array(
        jsonb_build_object('item_id', resistor, 'quantidade', 500)), null, true);
  ped := (r->>'pedido_id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.decidir_pedido(ped, true);
  begin
    perform public.gerar_romaneio_do_pedido(ped);
    raise notice 'FALHOU: deveria acusar saldo insuficiente';
  exception when others then
    raise notice '16) OK, saldo insuficiente: %', sqlerrm;
  end;
  perform public.cancelar_pedido(ped, 'não há estoque');
  select status into st from public.pedidos where id = ped;
  raise notice '17) cancelado: status=% (esperado cancelado)', st;

  -- 11) romaneio avulso (kit)
  r := public.gerar_romaneio_avulso('Kit competição',
        jsonb_build_array(jsonb_build_object('item_id', resistor, 'endereco_id', p2, 'quantidade', 2)));
  raise notice '18) avulso: codigo=% (esperado ROM-AAAA-0002)', r->>'codigo';
end $$;

rollback;
