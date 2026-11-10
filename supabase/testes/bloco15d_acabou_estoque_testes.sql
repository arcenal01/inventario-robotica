-- Teste da migration 0012 (aviso "acabou o estoque" e opção "não terá mais").
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TAE, TAA, TAP) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  prof uuid := gen_random_uuid();
  alu  uuid := gen_random_uuid();
  c uuid; t1 uuid; t2 uuid; a uuid; p1 uuid;
  resistor uuid; alicate uuid; nunca uuid; parado uuid;
  r record;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (prof, 'tae-prof@escola.local', '{"nome":"Professor TAE"}'),
    (alu,  'tae-aluno@escola.local', '{"nome":"Aluno TAE"}');
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id = alu;

  insert into public.categorias (nome, prefixo) values ('Teste 15D', 'TAE') returning id into c;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TAE Armário', 'TAA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('TAE Posição', 'TAP', 2, true)  returning id into t2;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a) returning id into p1;

  insert into public.itens (nome, categoria_id, tipo_controle) values ('Resistor TAE', c, 'consumivel') returning id into resistor;
  insert into public.itens (nome, categoria_id, tipo_controle) values ('Alicate TAE', c, 'emprestavel') returning id into alicate;
  insert into public.itens (nome, categoria_id, tipo_controle) values ('Nunca recebeu TAE', c, 'consumivel') returning id into nunca;
  insert into public.itens (nome, categoria_id, tipo_controle) values ('Parado TAE', c, 'consumivel') returning id into parado;

  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  perform public.registrar_entrada(resistor, p1, 5, gen_random_uuid());
  perform public.registrar_entrada(alicate,  p1, 2, gen_random_uuid());
  perform public.registrar_entrada(parado,   p1, 1, gen_random_uuid());

  -- 1) Padrão: avisar para repor; com saldo, não está esgotado
  select * into r from public.vw_itens_estoque where id = resistor;
  if r.repor and not r.esgotado then raise notice 'OK 1) com saldo: repor=%, esgotado=%', r.repor, r.esgotado;
  else raise notice 'FALHOU 1) repor=% esgotado=%', r.repor, r.esgotado; end if;

  -- 2) Saiu tudo: esgotado
  perform public.registrar_saida(resistor, p1, 5, gen_random_uuid());
  select * into r from public.vw_itens_estoque where id = resistor;
  if r.saldo_total = 0 and r.esgotado then raise notice 'OK 2) saiu tudo: esgotado';
  else raise notice 'FALHOU 2) saldo=% esgotado=%', r.saldo_total, r.esgotado; end if;

  -- 3) Ferramenta toda emprestada: saldo 0, mas NÃO acabou (vai voltar)
  perform public.emprestar(alicate, p1, alu, 2, gen_random_uuid());
  select * into r from public.vw_itens_estoque where id = alicate;
  if r.saldo_total = 0 and r.emprestado_em_aberto = 2 and not r.esgotado then raise notice 'OK 3) toda emprestada: não está esgotada';
  else raise notice 'FALHOU 3) saldo=% emprestado=% esgotado=%', r.saldo_total, r.emprestado_em_aberto, r.esgotado; end if;

  -- 4) Nunca recebeu entrada (ex.: importado sem estoque): sem aviso
  select * into r from public.vw_itens_estoque where id = nunca;
  if r.saldo_total = 0 and not r.esgotado then raise notice 'OK 4) nunca teve estoque: sem aviso';
  else raise notice 'FALHOU 4) saldo=% esgotado=%', r.saldo_total, r.esgotado; end if;

  -- 5) "Não terá mais": repor = false (o professor pode marcar)
  update public.itens set repor = false where id = resistor;
  select * into r from public.vw_itens_estoque where id = resistor;
  if not r.repor and r.esgotado then raise notice 'OK 5) não terá mais: repor=false (a tela não avisa)';
  else raise notice 'FALHOU 5) repor=% esgotado=%', r.repor, r.esgotado; end if;

  -- 6) Entrada nova: deixa de estar esgotado
  perform public.registrar_entrada(resistor, p1, 3, gen_random_uuid());
  select * into r from public.vw_itens_estoque where id = resistor;
  if r.saldo_total = 3 and not r.esgotado then raise notice 'OK 6) reposto: não está mais esgotado';
  else raise notice 'FALHOU 6) saldo=% esgotado=%', r.saldo_total, r.esgotado; end if;

  -- 7) Item inativo não entra no aviso
  perform public.registrar_saida(parado, p1, 1, gen_random_uuid());
  update public.itens set status = 'inativo' where id = parado;
  select * into r from public.vw_itens_estoque where id = parado;
  if not r.esgotado then raise notice 'OK 7) inativo: sem aviso';
  else raise notice 'FALHOU 7) inativo esgotado=%', r.esgotado; end if;
end $$;

-- 8) Aluno não consegue marcar "não terá mais" (RLS de itens: só professor/admin alteram)
do $$
declare
  alu uuid;
  item uuid;
  n int;
begin
  select id into alu from public.perfis where perfil = 'aluno' and status_cadastro = 'aprovado' limit 1;
  select id into item from public.itens where status = 'ativo' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.itens set repor = false where id = item;
  get diagnostics n = row_count;
  reset role;
  if n = 0 then raise notice 'OK 8) aluno não altera repor';
  else raise notice 'FALHOU 8) aluno alterou % linha(s)', n; end if;
end $$;

rollback;
