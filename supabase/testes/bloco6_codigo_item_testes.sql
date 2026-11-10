-- Teste da migration 0006 (código de item com 3 dígitos, contador por prefixo).
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TCA, TCB, TCC) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  ca uuid; cb uuid; cc uuid;
  i1 uuid; i2 uuid; i3 uuid; i4 uuid; i5 uuid;
  v  text;
begin
  insert into public.categorias (nome, prefixo) values ('Teste6 A', 'TCA') returning id into ca;
  insert into public.categorias (nome, prefixo) values ('Teste6 B', 'TCB') returning id into cb;

  -- 1) Cada prefixo começa no 001
  insert into public.itens (nome, categoria_id) values ('Item A1', ca) returning id into i1;
  insert into public.itens (nome, categoria_id) values ('Item B1', cb) returning id into i2;
  insert into public.itens (nome, categoria_id) values ('Item A2', ca) returning id into i3;

  select codigo into v from public.itens where id = i1;
  if v = 'TCA-001' then raise notice 'OK 1) primeiro TCA = %', v;
  else raise notice 'FALHOU 1) esperado TCA-001, veio %', v; end if;

  select codigo into v from public.itens where id = i2;
  if v = 'TCB-001' then raise notice 'OK 2) primeiro TCB = % (contagem separada)', v;
  else raise notice 'FALHOU 2) esperado TCB-001, veio %', v; end if;

  select codigo into v from public.itens where id = i3;
  if v = 'TCA-002' then raise notice 'OK 3) segundo TCA = %', v;
  else raise notice 'FALHOU 3) esperado TCA-002, veio %', v; end if;

  -- 4) Código definitivo: não muda
  update public.itens set codigo = 'XXX-999' where id = i1;
  select codigo into v from public.itens where id = i1;
  if v = 'TCA-001' then raise notice 'OK 4) código continua %', v;
  else raise notice 'FALHOU 4) código mudou para %', v; end if;

  -- 5) Prefixo trocado e reaproveitado por outra categoria: não repete código
  update public.categorias set prefixo = 'TCZ' where id = ca;
  insert into public.categorias (nome, prefixo) values ('Teste6 C', 'TCA') returning id into cc;
  insert into public.itens (nome, categoria_id) values ('Item C1', cc) returning id into i4;
  select codigo into v from public.itens where id = i4;
  if v = 'TCA-003' then raise notice 'OK 5) prefixo reaproveitado continua a contagem: %', v;
  else raise notice 'FALHOU 5) esperado TCA-003, veio %', v; end if;

  -- 6) Passando de 999 vira 4 dígitos (sem cortar o número)
  update public.contadores_codigo set ultimo = 999 where prefixo = 'TCB' and ano = 0;
  insert into public.itens (nome, categoria_id) values ('Item B1000', cb) returning id into i5;
  select codigo into v from public.itens where id = i5;
  if v = 'TCB-1000' then raise notice 'OK 6) depois do 999 vem %', v;
  else raise notice 'FALHOU 6) esperado TCB-1000, veio %', v; end if;

  -- 7) Sequência global antiga foi removida
  if to_regclass('public.itens_codigo_seq') is null then raise notice 'OK 7) itens_codigo_seq removida';
  else raise notice 'FALHOU 7) itens_codigo_seq ainda existe'; end if;
end $$;

rollback;
