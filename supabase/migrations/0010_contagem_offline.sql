-- =====================================================================
-- 0010_contagem_offline.sql: Bloco 15A
-- Só ACRESCENTA uma função (não altera a 0009).
-- Para contar sem conexão, o aparelho baixa ANTES os itens de TODAS as posições
-- de uma contagem numa única chamada (em vez de uma chamada por posição).
-- Mesmas regras da itens_para_contar: só aprovados, SEM quantidades.
-- =====================================================================

create function public.itens_para_contar_todos(p_contagem_id uuid)
returns table (endereco_id uuid, item_id uuid, codigo text, nome text, unidade text, situacao text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v public.contagens;
begin
  if auth.uid() is null or not public.e_aprovado() then
    raise exception 'Sem permissão.';
  end if;
  select * into v from public.contagens c where c.id = p_contagem_id;
  if v.id is null then
    raise exception 'Contagem não encontrada.';
  end if;

  -- reaproveita a função da 0009 posição por posição (mesma regra de situação e de categoria)
  return query
    select a.id, t.item_id, t.codigo, t.nome, t.unidade, t.situacao
      from public._enderecos_da_contagem(v.id) as a(id)
      cross join lateral public.itens_para_contar(v.id, a.id) as t
     order by a.id, t.nome;
end $$;

revoke execute on function public.itens_para_contar_todos(uuid) from public, anon;
grant  execute on function public.itens_para_contar_todos(uuid) to authenticated;
