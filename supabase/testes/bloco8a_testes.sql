-- Teste do Bloco 8A: troca de QR (mover endereço), proteções e inserção em lote. Termina em ROLLBACK.
-- Usa prefixos próprios (TSE...) para não colidir com o seed.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  tA uuid; tG uuid; tC uuid; tP uuid;
  cat uuid; it uuid;
  a uuid; g1 uuid; g2 uuid; cx uuid; p1 uuid; p2 uuid;
  v_res jsonb; v_n int; v_txt text; v_cod text; v_troca uuid;
  v_novo_cx uuid; v_novo_p1 uuid; v_saldo numeric;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tse-prof@escola.local', '{"nome":"Prof TSE"}'),
    (alu,  'tse-aluno@escola.local', '{"nome":"Aluno TSE"}');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alu;

  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TSE Armário', 'TEA', 1, false) returning id into tA;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TSE Gaveta',  'TEG', 2, false) returning id into tG;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TSE Caixa',   'TEC', 3, false) returning id into tC;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TSE Posição', 'TEP', 4, true)  returning id into tP;

  insert into public.enderecos (tipo_endereco_id, pai_id, nome) values (tA, null, 'Armário TSE') returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id, nome) values (tG, a, 'Gaveta 1') returning id into g1;
  insert into public.enderecos (tipo_endereco_id, pai_id, nome) values (tG, a, 'Gaveta 2') returning id into g2;
  insert into public.enderecos (tipo_endereco_id, pai_id, nome) values (tC, g1, 'Caixa de ferramentas') returning id into cx;

  -- 1) Inserção em lote numera certo (3 posições de uma vez)
  insert into public.enderecos (tipo_endereco_id, pai_id) select tP, cx from generate_series(1, 3);
  select string_agg(codigo, ',' order by numero) into v_txt from public.enderecos where pai_id = cx;
  raise notice '1) lote: % (esperado TEA01-TEG01-TEC01-TEP01,...-TEP02,...-TEP03)', v_txt;
  select id into p1 from public.enderecos where pai_id = cx and numero = 1;
  select id into p2 from public.enderecos where pai_id = cx and numero = 2;

  insert into public.categorias (nome, prefixo) values ('TSE Cat', 'TSE') returning id into cat;
  insert into public.itens (nome, categoria_id, unidade, tipo_controle) values ('Chave TSE', cat, 'un', 'consumivel') returning id into it;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(it, p1, 7, gen_random_uuid(), 'estoque inicial TSE');

  -- 2) Mover a caixa (com 3 posições e 7 itens) para a gaveta 2
  v_res := public.mover_endereco(cx, g2, 'reorganização');
  v_troca := (v_res ->> 'troca_id')::uuid;
  v_novo_cx := (v_res ->> 'endereco_novo_id')::uuid;
  raise notice '2) mover: % -> % etiquetas=% (esperado TEA01-TEG01-TEC01 -> TEA01-TEG02-TEC01, 4 etiquetas)',
    v_res ->> 'codigo_antigo', v_res ->> 'codigo_novo', v_res ->> 'etiquetas';

  select e.id into v_novo_p1 from public.enderecos e where e.pai_id = v_novo_cx and e.numero = 1;
  select codigo into v_cod from public.enderecos where id = v_novo_p1;
  raise notice '2b) posição nova: % (esperado TEA01-TEG02-TEC01-TEP01)', v_cod;

  select quantidade_atual into v_saldo from public.saldos_por_endereco where item_id = it and endereco_id = v_novo_p1;
  raise notice '3) saldo na posição nova=% (esperado 7)', v_saldo;
  select coalesce(sum(quantidade_atual), 0) into v_saldo from public.saldos_por_endereco where item_id = it and endereco_id = p1;
  raise notice '3b) saldo na posição antiga=% (esperado 0)', v_saldo;
  select count(*) into v_n from public.movimentacoes where item_id = it and tipo = 'transferencia' and motivo like 'Troca de QR:%';
  raise notice '3c) transferências no ledger=% (esperado 1)', v_n;

  select count(*) into v_n from public.enderecos where id in (cx, p1, p2) and not ativo and substituido_por_id is not null;
  raise notice '4) antigos desativados e ligados ao novo: % (esperado 3 de 3 sem contar a 3ª posição: 3)', v_n;
  select count(*) into v_n from public.enderecos where id in (select id from public.enderecos where pai_id = cx) and not ativo;
  raise notice '4b) as 3 posições antigas inativas: % (esperado 3)', v_n;

  select count(*) into v_n from public.vw_troca_qr_etiquetas where troca_id = v_troca;
  raise notice '5) linhas na view de etiquetas=% (esperado 4: caixa + 3 posições)', v_n;
  select count(*) into v_n from public.notificacoes where referencia_id = v_troca and tipo = 'troca_qr' and usuario_id = prof;
  raise notice '5b) notificação para o professor=% (esperado 1)', v_n;
  select status::text into v_txt from public.trocas_qr where id = v_troca;
  raise notice '5c) status da troca=% (esperado pendente)', v_txt;

  -- 6) Proteções
  begin
    update public.enderecos set substituido_por_id = null where id = cx;
    raise notice '6) FALHOU: mexeu em substituido_por_id direto';
  exception when others then raise notice '6) OK, troca só pela função: %', sqlerrm; end;
  begin
    update public.enderecos set ativo = true where id = cx;
    raise notice '6b) FALHOU: reativou endereço substituído';
  exception when others then raise notice '6b) OK, não reativa substituído: %', sqlerrm; end;
  begin
    insert into public.enderecos (tipo_endereco_id, pai_id) values (tP, cx);
    raise notice '6c) FALHOU: criou dentro de endereço inativo';
  exception when others then raise notice '6c) OK, não cria em inativo: %', sqlerrm; end;
  begin
    update public.enderecos set ativo = false where id = v_novo_p1;
    raise notice '6d) FALHOU: desativou posição com estoque';
  exception when others then raise notice '6d) OK, não desativa com estoque: %', sqlerrm; end;
  begin
    update public.enderecos set ativo = false where id = v_novo_cx;
    raise notice '6e) FALHOU: desativou caixa com posições ativas';
  exception when others then raise notice '6e) OK, não desativa com filhos ativos: %', sqlerrm; end;
  begin
    perform public.mover_endereco(a, g1, null);
    raise notice '6f) FALHOU: moveu para dentro de si mesmo';
  exception when others then raise notice '6f) OK, ciclo bloqueado: %', sqlerrm; end;
  begin
    perform public.mover_endereco(v_novo_cx, g2, null);
    raise notice '6g) FALHOU: moveu para onde já está';
  exception when others then raise notice '6g) OK, mesmo lugar: %', sqlerrm; end;

  -- 7) Aluno não move nem vê trocas
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  begin
    perform public.mover_endereco(v_novo_cx, g1, null);
    raise notice '7) FALHOU: aluno moveu endereço';
  exception when others then raise notice '7) OK, aluno bloqueado: %', sqlerrm; end;
  set local role authenticated;
  select count(*) into v_n from public.trocas_qr;
  raise notice '7b) aluno enxerga % trocas (esperado 0)', v_n;
  reset role;

  -- 8) Concluir troca
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.concluir_troca_qr(v_troca);
  select status::text into v_txt from public.trocas_qr where id = v_troca;
  select count(*) into v_n from public.notificacoes where referencia_id = v_troca and not lida;
  raise notice '8) concluída: status=% notificações não lidas=% (esperado concluida e 0)', v_txt, v_n;
  begin
    perform public.concluir_troca_qr(v_troca);
    raise notice '8b) FALHOU: concluiu duas vezes';
  exception when others then raise notice '8b) OK, não conclui duas vezes: %', sqlerrm; end;

  -- 9) Bloqueia mover endereço dentro de contagem em andamento
  perform public.abrir_contagem('por_endereco', v_novo_cx, null, 'teste TSE');
  begin
    perform public.mover_endereco(v_novo_cx, g1, null);
    raise notice '9) FALHOU: moveu durante contagem';
  exception when others then raise notice '9) OK, bloqueado durante contagem: %', sqlerrm; end;
end $$;

rollback;
