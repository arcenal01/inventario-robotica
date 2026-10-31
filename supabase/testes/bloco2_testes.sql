-- Teste do Bloco 2. Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TSB, TBA...) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  c uuid; t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  a uuid; g uuid; cx uuid; p uuid; i uuid;
begin
  insert into public.categorias (nome, prefixo) values ('Teste2', 'TSB') returning id into c;

  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste2 Armário', 'TBA', 1, false) returning id into t1;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste2 Gaveta', 'TBG', 2, false) returning id into t2;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste2 Caixa', 'TBC', 3, false) returning id into t3;
  insert into public.tipos_endereco (nome, prefixo, nivel, armazena_itens) values ('Teste2 Posição', 'TBP', 4, true)  returning id into t4;

  insert into public.enderecos (tipo_endereco_id, pai_id) values (t1, null) returning id into a;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t2, a)    returning id into g;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t3, g)    returning id into cx;
  insert into public.enderecos (tipo_endereco_id, pai_id) values (t4, cx)   returning id into p;
  raise notice 'Código da posição (esperado TBA01-TBG01-TBC01-TBP01): %',
    (select codigo from public.enderecos where id = p);

  insert into public.itens (nome, categoria_id, unidade, tipo_controle)
  values ('Sensor ultrassônico', c, 'un', 'consumivel') returning id into i;
  raise notice 'Código do item (esperado TSB-001, 3 dígitos por prefixo, desde a 0006): %', (select codigo from public.itens where id = i);

  -- Não pode ter saldo em gaveta
  begin
    insert into public.saldos_por_endereco (item_id, endereco_id, quantidade_atual) values (i, g, 5);
    raise notice 'FALHOU: deveria ter bloqueado saldo em gaveta';
  exception when others then
    raise notice 'OK, bloqueou saldo fora de posição: %', sqlerrm;
  end;

  -- Saldo em posição funciona
  insert into public.saldos_por_endereco (item_id, endereco_id, quantidade_atual) values (i, p, 5);
  raise notice 'OK, saldo em posição criado';

  -- Saldo negativo bloqueado
  begin
    update public.saldos_por_endereco set quantidade_atual = -1 where item_id = i;
    raise notice 'FALHOU: deveria ter bloqueado saldo negativo';
  exception when others then
    raise notice 'OK, bloqueou saldo negativo: %', sqlerrm;
  end;

  -- Código definitivo não muda
  update public.itens set codigo = 'XXX-9999', nome = 'Sensor HC-SR04' where id = i;
  raise notice 'Código após tentar alterar (deve continuar igual): %', (select codigo from public.itens where id = i);

  -- Endereço não pode ser movido
  begin
    update public.enderecos set pai_id = a where id = p;
    raise notice 'FALHOU: deveria ter bloqueado mover endereço';
  exception when others then
    raise notice 'OK, bloqueou mover endereço: %', sqlerrm;
  end;
end $$;

-- Todas as tabelas devem aparecer com rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;

rollback;
