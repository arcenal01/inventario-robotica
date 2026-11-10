-- =====================================================================
-- 0011_codigo_item_prefixo_livre.sql: prefixo do código do item escolhido por peça
-- Mesmo estilo do site de coleta (inventario-robotica-contagem): o prefixo NÃO
-- precisa ser o da categoria (ALI-001 e BRE-001 podem ser da categoria Ferramentas).
--
-- No cadastro, a coluna codigo aceita três formas:
--   ''          -> prefixo da categoria + próximo número (igual à 0006): FER-021
--   'ALI'       -> prefixo informado + próximo número desse prefixo:    ALI-004
--   'CHAV-001'  -> código completo (importação da planilha de coleta): mantido como está,
--                  e o contador do prefixo avança para nunca gerar um código repetido
-- Prefixo: 2 a 5 letras sem acento. Número: 3 dígitos até 999, depois cresce (ALI-1000).
-- Depois de criado, o código continua definitivo (UPDATE nunca muda).
-- Não altera as migrations anteriores.
-- =====================================================================

create or replace function public.gerar_codigo_item()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_entrada text;
  v_prefixo text;
  v_n       int;
  v_codigo  text;
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;            -- código definitivo nunca muda
    new.atualizado_em := now();
    return new;
  end if;

  v_entrada := upper(btrim(coalesce(new.codigo, '')));

  -- Código completo (importação): confere o formato e se já existe
  if v_entrada ~ '^[A-Z]{2,5}-[0-9]+$' then
    v_prefixo := split_part(v_entrada, '-', 1);
    v_n := split_part(v_entrada, '-', 2)::int;
    if v_n < 1 then
      raise exception 'Código % inválido: o número começa em 001.', v_entrada;
    end if;
    -- Forma única: ALI-001 (não ALI-1 nem ALI-0001), para o mesmo item não ter duas grafias
    v_codigo := v_prefixo || '-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end;
    if v_codigo <> v_entrada then
      raise exception 'Código % fora do padrão: use %.', v_entrada, v_codigo;
    end if;
    if exists (select 1 from public.itens i where i.codigo = v_codigo) then
      raise exception 'O código % já existe.', v_codigo;
    end if;

    insert into public.contadores_codigo as c (prefixo, ano, ultimo)
    values (v_prefixo, 0, v_n)
    on conflict (prefixo, ano) do update set ultimo = greatest(c.ultimo, excluded.ultimo);

    new.codigo := v_codigo;
    return new;
  end if;

  if v_entrada = '' then
    select c.prefixo into v_prefixo from public.categorias c where c.id = new.categoria_id;
  elsif v_entrada ~ '^[A-Z]{2,5}$' then
    v_prefixo := v_entrada;
  else
    raise exception 'Prefixo do código inválido (%): use de 2 a 5 letras, sem números nem acentos.', v_entrada;
  end if;

  -- Atômico: duas inserções ao mesmo tempo nunca pegam o mesmo número.
  -- O laço pula números já usados (ex.: código importado antes do contador existir).
  loop
    insert into public.contadores_codigo as c (prefixo, ano, ultimo)
    values (v_prefixo, 0, 1)
    on conflict (prefixo, ano) do update set ultimo = c.ultimo + 1
    returning c.ultimo into v_n;

    -- lpad CORTA textos maiores (lpad('1000', 3) = '100'): só completa com zeros até 3
    v_codigo := v_prefixo || '-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end;
    exit when not exists (select 1 from public.itens i where i.codigo = v_codigo);
  end loop;

  new.codigo := v_codigo;
  return new;
end $$;

revoke execute on function public.gerar_codigo_item() from public, anon, authenticated;
