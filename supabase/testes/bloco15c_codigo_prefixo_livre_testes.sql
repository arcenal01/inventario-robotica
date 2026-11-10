-- Teste da migration 0011 (prefixo do código escolhido por item; código completo na importação).
-- Tudo termina em ROLLBACK: não deixa dados no banco.
-- Usa prefixos próprios (TPA, TPB, TPX...) para não colidir com os dados do seed.sql.
begin;

do $$
declare
  ca uuid;
  i1 uuid; i2 uuid; i3 uuid; i4 uuid; i5 uuid; i6 uuid;
  v  text;
  deu_erro boolean;
begin
  insert into public.categorias (nome, prefixo) values ('Teste15c A', 'TPA') returning id into ca;

  -- 1) Sem código: continua usando o prefixo da categoria
  insert into public.itens (nome, categoria_id) values ('Sem prefixo', ca) returning id into i1;
  select codigo into v from public.itens where id = i1;
  if v = 'TPA-001' then raise notice 'OK 1) sem prefixo usa o da categoria: %', v;
  else raise notice 'FALHOU 1) esperado TPA-001, veio %', v; end if;

  -- 2) Só o prefixo (minúsculo e com espaço): prefixo próprio, contagem própria
  insert into public.itens (nome, categoria_id, codigo) values ('Prefixo livre', ca, ' tpx ') returning id into i2;
  select codigo into v from public.itens where id = i2;
  if v = 'TPX-001' then raise notice 'OK 2) prefixo livre: %', v;
  else raise notice 'FALHOU 2) esperado TPX-001, veio %', v; end if;

  -- 3) Código completo (importação) é mantido e o contador avança
  insert into public.itens (nome, categoria_id, codigo) values ('Importado', ca, 'TPB-020') returning id into i3;
  select codigo into v from public.itens where id = i3;
  if v = 'TPB-020' then raise notice 'OK 3) código importado mantido: %', v;
  else raise notice 'FALHOU 3) esperado TPB-020, veio %', v; end if;

  insert into public.itens (nome, categoria_id, codigo) values ('Depois do importado', ca, 'TPB') returning id into i4;
  select codigo into v from public.itens where id = i4;
  if v = 'TPB-021' then raise notice 'OK 4) próximo depois do importado: %', v;
  else raise notice 'FALHOU 4) esperado TPB-021, veio %', v; end if;

  -- 5) Importar um número MENOR não faz o contador voltar
  insert into public.itens (nome, categoria_id, codigo) values ('Buraco antigo', ca, 'TPB-005');
  insert into public.itens (nome, categoria_id, codigo) values ('Seguinte', ca, 'TPB') returning id into i5;
  select codigo into v from public.itens where id = i5;
  if v = 'TPB-022' then raise notice 'OK 5) contador não volta: %', v;
  else raise notice 'FALHOU 5) esperado TPB-022, veio %', v; end if;

  -- 6) Código repetido é recusado
  deu_erro := false;
  begin
    insert into public.itens (nome, categoria_id, codigo) values ('Repetido', ca, 'TPB-020');
  exception when others then deu_erro := true;
  end;
  if deu_erro then raise notice 'OK 6) código repetido recusado';
  else raise notice 'FALHOU 6) aceitou código repetido'; end if;

  -- 7) Fora do padrão é recusado (número sem zeros, zeros demais, prefixo com número/acento, 001 = mínimo)
  foreach v in array array['TPB-1', 'TPB-0030', 'TP1', 'ÁLI', 'TPB-000', 'T', 'TOOLONG'] loop
    deu_erro := false;
    begin
      insert into public.itens (nome, categoria_id, codigo) values ('Inválido', ca, v);
    exception when others then deu_erro := true;
    end;
    if deu_erro then raise notice 'OK 7) % recusado', v;
    else raise notice 'FALHOU 7) % foi aceito', v; end if;
  end loop;

  -- 8) Código continua definitivo
  update public.itens set codigo = 'TPZ-999' where id = i2;
  select codigo into v from public.itens where id = i2;
  if v = 'TPX-001' then raise notice 'OK 8) código continua %', v;
  else raise notice 'FALHOU 8) código mudou para %', v; end if;

  -- 9) Gerado pula número já usado (contador atrás de um código existente)
  update public.contadores_codigo set ultimo = 0 where prefixo = 'TPX' and ano = 0;
  insert into public.itens (nome, categoria_id, codigo) values ('Pula usado', ca, 'TPX') returning id into i6;
  select codigo into v from public.itens where id = i6;
  if v = 'TPX-002' then raise notice 'OK 9) pulou o código já usado: %', v;
  else raise notice 'FALHOU 9) esperado TPX-002, veio %', v; end if;

  -- 10) Prefixo de 4 letras (como CHAV-001 da planilha)
  insert into public.itens (nome, categoria_id, codigo) values ('Quatro letras', ca, 'TPQW-001') returning id into i6;
  select codigo into v from public.itens where id = i6;
  if v = 'TPQW-001' then raise notice 'OK 10) prefixo de 4 letras: %', v;
  else raise notice 'FALHOU 10) esperado TPQW-001, veio %', v; end if;
end $$;

rollback;
