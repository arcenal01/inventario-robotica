-- =====================================================================
-- 0006_codigo_item_3_digitos.sql: código de item com 3 dígitos e contador POR PREFIXO
-- Antes (0001): sequência global de 4 dígitos (SEN-0001, MOT-0002, SEN-0003...).
-- Agora: cada prefixo tem a própria contagem (SEN-001, SEN-002, MOT-001...).
-- Passando de 999 o número só cresce (SEN-1000): nada quebra.
-- Códigos já gravados continuam iguais (são definitivos).
-- =====================================================================

-- Reaproveita a tabela técnica contadores_codigo (Bloco 4) com ano = 0 = "sem ano".
-- O contador fica ligado ao PREFIXO (não à categoria): se o admin trocar o prefixo de
-- uma categoria e outra categoria passar a usar o prefixo antigo, a contagem continua
-- de onde parou e nenhum código se repete.

-- Itens que já existiam: o contador de cada prefixo começa no maior número já usado,
-- para que um código novo nunca repita um antigo (ex.: SEN-0012 existe -> próximo SEN-013).
insert into public.contadores_codigo as c (prefixo, ano, ultimo)
select split_part(i.codigo, '-', 1), 0, max(split_part(i.codigo, '-', 2)::int)
from public.itens i
where i.codigo ~ '^[A-Z]{2,5}-[0-9]+$'
group by split_part(i.codigo, '-', 1)
on conflict (prefixo, ano) do update set ultimo = greatest(c.ultimo, excluded.ultimo);

create or replace function public.gerar_codigo_item()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefixo text;
  v_n       int;
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;            -- código definitivo nunca muda
    new.atualizado_em := now();
    return new;
  end if;

  select c.prefixo into v_prefixo from public.categorias c where c.id = new.categoria_id;

  -- Atômico: duas inserções ao mesmo tempo nunca pegam o mesmo número
  insert into public.contadores_codigo as c (prefixo, ano, ultimo)
  values (v_prefixo, 0, 1)
  on conflict (prefixo, ano) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_n;

  -- lpad CORTA textos maiores (lpad('1000', 3) = '100'): só completa com zeros até 3
  new.codigo := v_prefixo || '-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end;
  return new;
end $$;

-- A sequência global não é mais usada
drop sequence if exists public.itens_codigo_seq;
