-- =====================================================================
-- 0009_contagem_telas.sql: Bloco 12
-- Leitura para as telas de contagem. Só ACRESCENTA funções (não altera o Bloco 5).
-- O aluno só enxerga as próprias linhas em contagem_itens (RLS); estas funções dizem
-- o que falta contar em cada posição SEM devolver quantidades contadas por outras pessoas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Posições da contagem e a situação de cada uma
-- ---------------------------------------------------------------------
create function public.posicoes_da_contagem(p_contagem_id uuid)
returns table (
  endereco_id     uuid,
  codigo          text,
  nome            text,
  ativo           boolean,
  itens_contados  int,      -- itens contados por alguém (sem os "não listados")
  itens_faltando  int,      -- itens com saldo no sistema que ninguém contou ainda
  recontagens     int,      -- itens esperando recontagem
  sem_contagem    boolean,  -- ninguém registrou nada nesta posição
  contada_por_mim boolean)
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

  return query
    select e.id, e.codigo, e.nome, e.ativo,
      (select count(distinct ci.item_id)::int
         from public.contagem_itens ci
        where ci.contagem_id = v.id and ci.endereco_id = e.id and not ci.nao_listado),
      (select count(*)::int
         from public.saldos_por_endereco s
         join public.itens i on i.id = s.item_id
        where s.endereco_id = e.id and s.quantidade_atual > 0
          and (v.escopo <> 'por_categoria' or i.categoria_id = v.categoria_id)
          and not exists (select 1 from public.contagem_itens ci
                           where ci.contagem_id = v.id and ci.endereco_id = e.id
                             and ci.item_id = s.item_id)),
      (select count(*)::int
         from public.contagem_itens ci
        where ci.contagem_id = v.id and ci.endereco_id = e.id and ci.recontagem_pendente),
      not exists (select 1 from public.contagem_itens ci
                   where ci.contagem_id = v.id and ci.endereco_id = e.id),
      exists (select 1 from public.contagem_itens ci
               where ci.contagem_id = v.id and ci.endereco_id = e.id
                 and ci.contado_por = auth.uid())
    from public._enderecos_da_contagem(v.id) as a(id)
    join public.enderecos e on e.id = a.id
    order by e.codigo;
end $$;

-- ---------------------------------------------------------------------
-- Itens de UMA posição para a tela de contar
-- situacao: contar | contado | recontar | recontar_outro (você contou: outra pessoa reconta)
-- Lista os itens com saldo na posição + os que já têm linha na contagem (achados a mais).
-- ---------------------------------------------------------------------
create function public.itens_para_contar(p_contagem_id uuid, p_endereco_id uuid)
returns table (item_id uuid, codigo text, nome text, unidade text, situacao text)
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
  if not exists (select 1 from public._enderecos_da_contagem(v.id) as a(id) where a.id = p_endereco_id) then
    raise exception 'Este endereço não faz parte desta contagem.';
  end if;

  return query
    with ult as (
      select distinct on (ci.item_id) ci.item_id, ci.recontagem_pendente, ci.contado_por
        from public.contagem_itens ci
       where ci.contagem_id = v.id and ci.endereco_id = p_endereco_id
       order by ci.item_id, ci.rodada desc
    ), candidatos as (
      select s.item_id from public.saldos_por_endereco s
       where s.endereco_id = p_endereco_id and s.quantidade_atual > 0
      union
      select u.item_id from ult u
    )
    select i.id, i.codigo, i.nome, i.unidade::text,
      case
        when u.item_id is null then 'contar'
        when u.recontagem_pendente and u.contado_por = auth.uid() then 'recontar_outro'
        when u.recontagem_pendente then 'recontar'
        else 'contado'
      end
    from candidatos k
    join public.itens i on i.id = k.item_id
    left join ult u on u.item_id = k.item_id
    where v.escopo <> 'por_categoria' or i.categoria_id = v.categoria_id
    order by i.nome;
end $$;

-- Aprovados chamam; anônimos não
revoke execute on function public.posicoes_da_contagem(uuid), public.itens_para_contar(uuid, uuid) from public, anon;
grant  execute on function public.posicoes_da_contagem(uuid), public.itens_para_contar(uuid, uuid) to authenticated;
