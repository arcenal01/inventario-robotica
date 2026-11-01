-- =====================================================================
-- 0008_itens_fotos_estoque.sql: Bloco 8B (itens)
-- 1) Bucket "itens-fotos" no Storage: leitura pública, escrita só professor/admin
-- 2) View vw_itens_estoque: item + categoria + saldo total + emprestado + abaixo do mínimo
-- 3) Proteções do item: unidade e tipo de controle não mudam depois que há histórico;
--    estoque mínimo inteiro para "un"; foto_url guarda o CAMINHO no bucket (não a URL),
--    para continuar valendo quando o sistema for para a nuvem
-- Não altera as migrations anteriores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) FOTOS DOS ITENS
-- ---------------------------------------------------------------------
-- Público para leitura: foto de componente não é dado sensível e a URL pública
-- facilita o cache offline (Bloco 14). O app reduz a foto antes de enviar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('itens-fotos', 'itens-fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy itens_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'itens-fotos' and (select public.e_aprovado()));
create policy itens_fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'itens-fotos' and (select public.e_professor_ou_admin()));
create policy itens_fotos_trocar on storage.objects for update to authenticated
  using      (bucket_id = 'itens-fotos' and (select public.e_professor_ou_admin()))
  with check (bucket_id = 'itens-fotos' and (select public.e_professor_ou_admin()));
create policy itens_fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'itens-fotos' and (select public.e_professor_ou_admin()));

-- ---------------------------------------------------------------------
-- 2) ESTOQUE POR ITEM (para a lista e, depois, para o dashboard)
-- ---------------------------------------------------------------------
-- security_invoker: quem consulta continua sujeito ao RLS de itens, categorias e saldos.
create view public.vw_itens_estoque
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
     and coalesce(s.saldo_total, 0) < i.estoque_minimo) as abaixo_minimo
from public.itens i
join public.categorias c on c.id = i.categoria_id
left join (
  select item_id, sum(quantidade_atual) as saldo_total,
         count(*) filter (where quantidade_atual > 0) as enderecos_com_saldo
  from public.saldos_por_endereco
  group by item_id
) s on s.item_id = i.id
left join (
  -- Aluno só enxerga os próprios empréstimos (RLS): para ele o número é parcial.
  select item_id, sum(quantidade - quantidade_devolvida - quantidade_perdida) as emprestado_em_aberto
  from public.emprestimos
  where status in ('em_aberto', 'devolvido_parcial')
  group by item_id
) e on e.item_id = i.id;

revoke all on public.vw_itens_estoque from anon;
grant select on public.vw_itens_estoque to authenticated;

-- ---------------------------------------------------------------------
-- 3) PROTEÇÕES DO ITEM (valem para qualquer escrita, inclusive pela tela)
-- ---------------------------------------------------------------------
create function public.proteger_item()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.unidade = 'un' and new.estoque_minimo <> trunc(new.estoque_minimo) then
    raise exception 'Itens em unidade "un" aceitam apenas estoque mínimo inteiro.';
  end if;

  if tg_op = 'UPDATE'
     and (new.unidade <> old.unidade or new.tipo_controle <> old.tipo_controle)
     and (exists (select 1 from public.movimentacoes m where m.item_id = old.id)
          or exists (select 1 from public.saldos_por_endereco s where s.item_id = old.id)) then
    raise exception 'Este item já tem movimentações: a unidade e o tipo de controle não podem mudar. Cadastre um item novo.';
  end if;

  return new;
end $$;

revoke execute on function public.proteger_item() from public, anon, authenticated;

create trigger itens_protecao
  before insert or update on public.itens
  for each row execute function public.proteger_item();
