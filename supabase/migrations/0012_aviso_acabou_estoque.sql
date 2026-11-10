-- =====================================================================
-- 0012_aviso_acabou_estoque.sql: aviso "acabou o estoque" no lugar de "abaixo do mínimo"
-- Pedido do usuário: a tela não usa mais o estoque mínimo. O aviso aparece quando o item
-- ACABA (saldo zero), pedindo para repor, ou o item é marcado como "não terá mais".
--
-- 1) itens.repor: true = avisar para repor quando acabar (padrão);
--                 false = "não terá mais no estoque" (sem aviso).
-- 2) vw_itens_estoque ganha, no FIM (create or replace só deixa acrescentar colunas):
--    repor e esgotado = item ativo que já teve estoque (tem linha de saldo), está com
--    saldo zero e não tem nada emprestado (ferramenta toda emprestada não "acabou").
--    Item cadastrado/importado que nunca recebeu entrada não aparece como esgotado.
-- estoque_minimo e abaixo_minimo continuam no banco (sem uso na tela), para não quebrar nada.
-- Não altera as migrations anteriores.
-- =====================================================================

alter table public.itens add column repor boolean not null default true;

comment on column public.itens.repor is
  'true = avisar para repor quando o estoque acabar; false = não terá mais no estoque (sem aviso)';

create or replace view public.vw_itens_estoque
with (security_invoker = true) as
select
  i.id, i.codigo, i.nome, i.categoria_id,
  c.nome    as categoria_nome,
  c.prefixo as categoria_prefixo,
  i.unidade, i.descricao, i.foto_url, i.especificacoes, i.estoque_minimo,
  i.tipo_controle, i.status, i.criado_em, i.atualizado_em,
  coalesce(s.saldo_total, 0)::numeric(12,3)       as saldo_total,
  coalesce(s.enderecos_com_saldo, 0)::int         as enderecos_com_saldo,
  coalesce(e.emprestado_em_aberto, 0)::numeric(12,3) as emprestado_em_aberto,
  (i.status = 'ativo' and i.estoque_minimo > 0
     and coalesce(s.saldo_total, 0) < i.estoque_minimo) as abaixo_minimo,
  i.repor,
  -- Aluno só enxerga os próprios empréstimos (RLS): para ele "emprestado" é parcial
  (i.status = 'ativo' and s.item_id is not null
     and coalesce(s.saldo_total, 0) <= 0
     and coalesce(e.emprestado_em_aberto, 0) <= 0) as esgotado
from public.itens i
join public.categorias c on c.id = i.categoria_id
left join (
  select item_id, sum(quantidade_atual) as saldo_total,
         count(*) filter (where quantidade_atual > 0) as enderecos_com_saldo
  from public.saldos_por_endereco
  group by item_id
) s on s.item_id = i.id
left join (
  select item_id, sum(quantidade - quantidade_devolvida - quantidade_perdida) as emprestado_em_aberto
  from public.emprestimos
  where status in ('em_aberto', 'devolvido_parcial')
  group by item_id
) e on e.item_id = i.id;

revoke all on public.vw_itens_estoque from anon;
grant select on public.vw_itens_estoque to authenticated;
