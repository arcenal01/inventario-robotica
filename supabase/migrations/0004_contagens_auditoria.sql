-- =====================================================================
-- 0004_contagens_auditoria.sql: Bloco 5
-- Contagem de estoque (comparação, recontagem, aprovação com ajustes) e auditoria
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.status_contagem as enum
  ('aberta', 'em_andamento', 'em_revisao', 'aprovada', 'cancelada');

create type public.escopo_contagem as enum
  ('geral', 'por_endereco', 'por_categoria');

-- ---------------------------------------------------------------------
-- CONTAGENS
-- por_endereco: conta o endereço escolhido e tudo que está dentro dele
-- por_categoria: todas as posições, só itens da categoria
-- ---------------------------------------------------------------------
create table public.contagens (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique default '',
  escopo        public.escopo_contagem not null,
  endereco_id   uuid references public.enderecos(id) on delete restrict,
  categoria_id  uuid references public.categorias(id) on delete restrict,
  status        public.status_contagem not null default 'aberta',
  observacao    text,
  aberta_por    uuid not null references public.perfis(id) on delete restrict,
  aprovada_por  uuid references public.perfis(id),
  aprovada_em   timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((escopo = 'por_endereco')  = (endereco_id  is not null)),
  check ((escopo = 'por_categoria') = (categoria_id is not null))
);
create index contagens_status_idx on public.contagens (status);

create trigger contagens_codigo
  before insert or update on public.contagens
  for each row execute function public.gerar_codigo_anual('CNT');

-- Cada linha = um item contado em uma posição, em uma rodada (1 = primeira, 2+ = recontagem)
create table public.contagem_itens (
  id                     uuid primary key default gen_random_uuid(),
  contagem_id            uuid not null references public.contagens(id) on delete cascade,
  endereco_id            uuid not null references public.enderecos(id) on delete restrict,
  item_id                uuid not null references public.itens(id) on delete restrict,
  rodada                 int  not null default 1 check (rodada >= 1),
  quantidade_sistema     numeric(12,3) not null check (quantidade_sistema >= 0),
  quantidade_contada     numeric(12,3) not null check (quantidade_contada >= 0),
  emprestado_em_aberto   numeric(12,3) not null default 0,   -- só informativo
  divergencia            numeric(12,3) not null,             -- contada - sistema
  contado_por            uuid references public.perfis(id),  -- nulo = "não listado"
  contado_em             timestamptz not null default now(),
  chave_idempotencia     uuid not null unique,
  nao_listado            boolean not null default false,
  recontagem_pendente    boolean not null default false,
  ajuste_movimentacao_id uuid references public.movimentacoes(id) on delete restrict,
  unique (contagem_id, endereco_id, item_id, rodada)
);
create index contagem_itens_idx on public.contagem_itens (contagem_id, endereco_id);

-- Agora que contagens existe, o ledger ganha a chave estrangeira
alter table public.movimentacoes
  add constraint movimentacoes_contagem_fk
  foreign key (contagem_id) references public.contagens(id) on delete restrict;

-- ---------------------------------------------------------------------
-- AUDITORIA (imutável)
-- ---------------------------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  usuario_id   uuid references public.perfis(id) on delete set null,
  acao         text not null,            -- INSERT, UPDATE, DELETE
  tabela       text not null,
  registro_id  uuid,
  dados_antes  jsonb,
  dados_depois jsonb,
  criado_em    timestamptz not null default now()
);
create index auditoria_registro_idx on public.auditoria (tabela, registro_id);
create index auditoria_data_idx     on public.auditoria (criado_em desc);

create function public.bloquear_alteracao_auditoria()
returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'A auditoria é imutável: não pode ser alterada nem apagada.';
end $$;

create trigger auditoria_imutavel
  before update or delete on public.auditoria
  for each row execute function public.bloquear_alteracao_auditoria();

create function public.registrar_auditoria()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_antes  := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_depois := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and v_antes = v_depois then
    return null;
  end if;

  insert into public.auditoria (usuario_id, acao, tabela, registro_id, dados_antes, dados_depois)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_depois ->> 'id', v_antes ->> 'id')::uuid, v_antes, v_depois);
  return null;
end $$;

-- Tabelas importantes (movimentacoes já é um log por si só; saldos mudam demais)
do $$
declare
  t text;
begin
  foreach t in array array['perfis', 'categorias', 'tipos_endereco', 'enderecos', 'itens',
                           'emprestimos', 'pedidos', 'romaneios', 'contagens']
  loop
    execute format(
      'create trigger auditoria_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- FUNÇÃO INTERNA: posições que fazem parte de uma contagem
-- ---------------------------------------------------------------------
create function public._enderecos_da_contagem(p_contagem_id uuid)
returns setof uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.contagens;
begin
  select * into v from public.contagens where id = p_contagem_id;

  return query
    with recursive arv as (
      select e.id from public.enderecos e
       where (v.escopo = 'por_endereco' and e.id = v.endereco_id)
          or (v.escopo <> 'por_endereco' and e.pai_id is null)
      union all
      select f.id from public.enderecos f join arv on f.pai_id = arv.id
    )
    select a.id
      from arv a
      join public.enderecos e       on e.id = a.id
      join public.tipos_endereco t  on t.id = e.tipo_endereco_id
     where t.armazena_itens
       and (e.ativo or exists (select 1 from public.saldos_por_endereco s
                                where s.endereco_id = e.id and s.quantidade_atual > 0));
end $$;

-- ---------------------------------------------------------------------
-- RPC: ABRIR CONTAGEM (professor/admin)
-- ---------------------------------------------------------------------
create function public.abrir_contagem(
  p_escopo public.escopo_contagem,
  p_endereco_id uuid default null,
  p_categoria_id uuid default null,
  p_observacao text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cnt public.contagens;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_escopo = 'por_endereco' and not exists (select 1 from public.enderecos where id = p_endereco_id) then
    raise exception 'Escolha o endereço que será contado.';
  end if;
  if p_escopo = 'por_categoria' and not exists (select 1 from public.categorias where id = p_categoria_id) then
    raise exception 'Escolha a categoria que será contada.';
  end if;
  if exists (select 1 from public.contagens
              where escopo = p_escopo
                and endereco_id  is not distinct from p_endereco_id
                and categoria_id is not distinct from p_categoria_id
                and status in ('aberta', 'em_andamento', 'em_revisao')) then
    raise exception 'Já existe uma contagem em andamento com este mesmo escopo.';
  end if;

  insert into public.contagens (escopo, endereco_id, categoria_id, observacao, aberta_por)
  values (p_escopo,
          case when p_escopo = 'por_endereco'  then p_endereco_id  end,
          case when p_escopo = 'por_categoria' then p_categoria_id end,
          p_observacao, v_uid)
  returning * into v_cnt;

  return jsonb_build_object('contagem_id', v_cnt.id, 'codigo', v_cnt.codigo,
    'enderecos', (select count(*) from public._enderecos_da_contagem(v_cnt.id)));
end $$;

-- ---------------------------------------------------------------------
-- RPC: REGISTRAR CONTAGEM de uma posição (aluno, professor ou admin; offline-friendly)
-- p_itens = [{"item_id": "...", "quantidade": 8}]
-- Uma chamada = uma posição, tudo ou nada. A mesma chave não conta duas vezes.
-- ---------------------------------------------------------------------
create function public.registrar_contagem(
  p_contagem_id uuid, p_endereco_id uuid, p_itens jsonb, p_chave_idempotencia uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_cnt  public.contagens;
  v_item public.itens;
  v_ult  public.contagem_itens;
  v_rod  int;
  v_sis  numeric;
  v_emp  numeric;
  v_n    int := 0;
  r record;
begin
  if v_uid is null or not public.e_aprovado() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos um item contado.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_chave_idempotencia::text, 4));

  select * into v_cnt from public.contagens where id = p_contagem_id;
  if v_cnt.id is null then
    raise exception 'Contagem não encontrada.';
  end if;

  -- reenvio (offline): se a primeira linha desta chave já existe, tudo já foi gravado
  if exists (
    select 1 from public.contagem_itens ci
     where ci.contagem_id = p_contagem_id
       and ci.chave_idempotencia in (
         select md5(p_chave_idempotencia::text || x.item_id::text)::uuid
           from jsonb_to_recordset(p_itens) as x(item_id uuid, quantidade numeric))
  ) then
    return jsonb_build_object('contagem_id', p_contagem_id, 'duplicada', true);
  end if;

  if v_cnt.status not in ('aberta', 'em_andamento') then
    raise exception 'Esta contagem não está recebendo contagens (status: %).', v_cnt.status;
  end if;
  if not exists (select 1 from public._enderecos_da_contagem(p_contagem_id) as a(id)
                  where a.id = p_endereco_id) then
    raise exception 'Este endereço não faz parte desta contagem.';
  end if;
  if (select count(*) <> count(distinct x.item_id)
        from jsonb_to_recordset(p_itens) as x(item_id uuid, quantidade numeric)) then
    raise exception 'Há itens repetidos na mesma contagem.';
  end if;

  for r in select * from jsonb_to_recordset(p_itens) as x(item_id uuid, quantidade numeric)
  loop
    v_item := public._carregar_item(r.item_id, r.quantidade, false, true);
    if v_cnt.escopo = 'por_categoria' and v_item.categoria_id <> v_cnt.categoria_id then
      raise exception 'O item % não pertence à categoria desta contagem.', v_item.codigo;
    end if;

    select * into v_ult from public.contagem_itens
     where contagem_id = p_contagem_id and endereco_id = p_endereco_id and item_id = r.item_id
     order by rodada desc limit 1;

    if v_ult.id is null then
      v_rod := 1;
    elsif v_ult.recontagem_pendente then
      if v_ult.contado_por = v_uid then
        raise exception 'A recontagem de % deve ser feita por outra pessoa.', v_item.codigo;
      end if;
      v_rod := v_ult.rodada + 1;
      update public.contagem_itens set recontagem_pendente = false where id = v_ult.id;
    else
      raise exception 'O item % já foi contado neste endereço.', v_item.codigo;
    end if;

    select s.quantidade_atual into v_sis
      from public.saldos_por_endereco s
     where s.item_id = r.item_id and s.endereco_id = p_endereco_id;
    v_sis := coalesce(v_sis, 0);

    -- Empréstimos em aberto saíram do saldo na hora do empréstimo: não geram divergência.
    -- O valor é guardado só para o professor ver.
    select coalesce(sum(e.quantidade - e.quantidade_devolvida - e.quantidade_perdida), 0) into v_emp
      from public.emprestimos e
     where e.item_id = r.item_id and e.endereco_origem_id = p_endereco_id
       and e.status in ('em_aberto', 'devolvido_parcial');

    insert into public.contagem_itens
      (contagem_id, endereco_id, item_id, rodada, quantidade_sistema, quantidade_contada,
       emprestado_em_aberto, divergencia, contado_por, chave_idempotencia)
    values
      (p_contagem_id, p_endereco_id, r.item_id, v_rod, v_sis, r.quantidade,
       v_emp, r.quantidade - v_sis, v_uid,
       md5(p_chave_idempotencia::text || r.item_id::text)::uuid);
    v_n := v_n + 1;
  end loop;

  if v_cnt.status = 'aberta' then
    update public.contagens set status = 'em_andamento', atualizado_em = now() where id = v_cnt.id;
  end if;

  return jsonb_build_object('contagem_id', p_contagem_id, 'itens_registrados', v_n, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: ENCERRAR A CONTAGEM e ir para a revisão (professor/admin)
-- Itens com saldo que ficaram fora da lista de uma posição contada viram "não listado" (contado = 0).
-- ---------------------------------------------------------------------
create function public.encerrar_contagem(p_contagem_id uuid, p_forcar boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cnt  public.contagens;
  v_pend int;
  v_div  int;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_cnt from public.contagens where id = p_contagem_id for update;
  if v_cnt.id is null then
    raise exception 'Contagem não encontrada.';
  end if;
  if v_cnt.status <> 'em_andamento' then
    raise exception 'Só contagens em andamento podem ser encerradas (status: %).', v_cnt.status;
  end if;
  if exists (select 1 from public.contagem_itens where contagem_id = v_cnt.id and recontagem_pendente) then
    raise exception 'Há recontagens pendentes.';
  end if;

  select count(*) into v_pend
    from public._enderecos_da_contagem(v_cnt.id) as a(id)
   where not exists (select 1 from public.contagem_itens ci
                      where ci.contagem_id = v_cnt.id and ci.endereco_id = a.id);
  if v_pend > 0 and not p_forcar then
    raise exception 'Faltam % endereço(s) sem contagem. Use p_forcar = true para encerrar assim mesmo.', v_pend;
  end if;

  insert into public.contagem_itens
    (contagem_id, endereco_id, item_id, rodada, quantidade_sistema, quantidade_contada,
     emprestado_em_aberto, divergencia, contado_por, chave_idempotencia, nao_listado)
  select v_cnt.id, s.endereco_id, s.item_id, 1, s.quantidade_atual, 0,
         coalesce((select sum(e.quantidade - e.quantidade_devolvida - e.quantidade_perdida)
                     from public.emprestimos e
                    where e.item_id = s.item_id and e.endereco_origem_id = s.endereco_id
                      and e.status in ('em_aberto', 'devolvido_parcial')), 0),
         -s.quantidade_atual, null, gen_random_uuid(), true
    from public.saldos_por_endereco s
    join public.itens i on i.id = s.item_id
   where s.quantidade_atual > 0
     and s.endereco_id in (select a.id from public._enderecos_da_contagem(v_cnt.id) as a(id))
     and exists (select 1 from public.contagem_itens ci
                  where ci.contagem_id = v_cnt.id and ci.endereco_id = s.endereco_id)
     and not exists (select 1 from public.contagem_itens ci
                      where ci.contagem_id = v_cnt.id and ci.endereco_id = s.endereco_id
                        and ci.item_id = s.item_id)
     and (v_cnt.escopo <> 'por_categoria' or i.categoria_id = v_cnt.categoria_id);

  update public.contagens set status = 'em_revisao', atualizado_em = now() where id = v_cnt.id;

  select count(*) into v_div
    from public.contagem_itens ci
   where ci.contagem_id = v_cnt.id and ci.divergencia <> 0
     and ci.rodada = (select max(x.rodada) from public.contagem_itens x
                       where x.contagem_id = ci.contagem_id and x.endereco_id = ci.endereco_id
                         and x.item_id = ci.item_id);

  return jsonb_build_object('contagem_id', v_cnt.id, 'status', 'em_revisao',
                            'enderecos_sem_contagem', v_pend, 'divergencias', v_div);
end $$;

-- ---------------------------------------------------------------------
-- RPC: PEDIR RECONTAGEM de uma posição (ou de um item dela). Outra pessoa deve contar.
-- ---------------------------------------------------------------------
create function public.solicitar_recontagem(
  p_contagem_id uuid, p_endereco_id uuid, p_item_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cnt public.contagens;
  v_n   int;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_cnt from public.contagens where id = p_contagem_id for update;
  if v_cnt.id is null then
    raise exception 'Contagem não encontrada.';
  end if;
  if v_cnt.status <> 'em_revisao' then
    raise exception 'Só é possível pedir recontagem durante a revisão.';
  end if;

  update public.contagem_itens ci
     set recontagem_pendente = true
   where ci.contagem_id = p_contagem_id
     and ci.endereco_id = p_endereco_id
     and (p_item_id is null or ci.item_id = p_item_id)
     and ci.divergencia <> 0
     and ci.ajuste_movimentacao_id is null
     and ci.rodada = (select max(x.rodada) from public.contagem_itens x
                       where x.contagem_id = ci.contagem_id and x.endereco_id = ci.endereco_id
                         and x.item_id = ci.item_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Nenhuma divergência encontrada para recontar.';
  end if;

  update public.contagens set status = 'em_andamento', atualizado_em = now() where id = v_cnt.id;
  return jsonb_build_object('contagem_id', v_cnt.id, 'status', 'em_andamento', 'itens_para_recontar', v_n);
end $$;

-- ---------------------------------------------------------------------
-- RPC: APROVAR CONTAGEM (professor/admin) e gerar os ajustes
-- O ajuste soma a divergência ao saldo ATUAL (não força o valor contado), assim
-- movimentos feitos depois da contagem não são desfeitos.
-- ---------------------------------------------------------------------
create function public.aprovar_contagem(p_contagem_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_cnt   public.contagens;
  v_atual numeric;
  v_nova  numeric;
  v_res   jsonb;
  v_aj    int := 0;
  r record;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_cnt from public.contagens where id = p_contagem_id for update;
  if v_cnt.id is null then
    raise exception 'Contagem não encontrada.';
  end if;
  if v_cnt.status <> 'em_revisao' then
    raise exception 'Só contagens em revisão podem ser aprovadas (status: %).', v_cnt.status;
  end if;
  if exists (select 1 from public.contagem_itens where contagem_id = v_cnt.id and recontagem_pendente) then
    raise exception 'Há recontagens pendentes.';
  end if;

  for r in select ci.*
             from public.contagem_itens ci
            where ci.contagem_id = v_cnt.id
              and ci.divergencia <> 0
              and ci.ajuste_movimentacao_id is null
              and ci.rodada = (select max(x.rodada) from public.contagem_itens x
                                where x.contagem_id = ci.contagem_id and x.endereco_id = ci.endereco_id
                                  and x.item_id = ci.item_id)
            order by ci.item_id, ci.endereco_id
  loop
    select s.quantidade_atual into v_atual
      from public.saldos_por_endereco s
     where s.item_id = r.item_id and s.endereco_id = r.endereco_id;
    v_atual := coalesce(v_atual, 0);
    v_nova  := v_atual + r.divergencia;

    if v_nova < 0 then
      raise exception 'O saldo atual não comporta o ajuste de uma das divergências: peça nova recontagem.';
    end if;

    v_res := public.ajustar(r.item_id, r.endereco_id, v_nova,
                            'Contagem ' || v_cnt.codigo,
                            md5(r.id::text)::uuid, v_cnt.id);

    update public.contagem_itens
       set ajuste_movimentacao_id = (v_res ->> 'movimentacao_id')::uuid
     where id = r.id;
    v_aj := v_aj + 1;
  end loop;

  update public.contagens
     set status = 'aprovada', aprovada_por = v_uid, aprovada_em = now(), atualizado_em = now()
   where id = v_cnt.id;

  return jsonb_build_object('contagem_id', v_cnt.id, 'status', 'aprovada', 'ajustes_gerados', v_aj);
end $$;

-- ---------------------------------------------------------------------
-- RPC: CANCELAR CONTAGEM (nenhum ajuste é gerado)
-- ---------------------------------------------------------------------
create function public.cancelar_contagem(p_contagem_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cnt public.contagens;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_cnt from public.contagens where id = p_contagem_id for update;
  if v_cnt.id is null then
    raise exception 'Contagem não encontrada.';
  end if;
  if v_cnt.status in ('aprovada', 'cancelada') then
    raise exception 'Esta contagem já foi encerrada.';
  end if;

  update public.contagens set status = 'cancelada', atualizado_em = now() where id = v_cnt.id;
  return jsonb_build_object('contagem_id', v_cnt.id, 'status', 'cancelada');
end $$;

-- ---------------------------------------------------------------------
-- VIEWS (respeitam a RLS de quem consulta)
-- vw_contagem_atual = última rodada de cada item/posição; divergências = só o que difere
-- ---------------------------------------------------------------------
create view public.vw_contagem_atual
with (security_invoker = true) as
select distinct on (ci.contagem_id, ci.endereco_id, ci.item_id)
  ci.id, ci.contagem_id, c.codigo as contagem_codigo,
  ci.endereco_id, e.codigo as endereco_codigo,
  ci.item_id, i.codigo as item_codigo, i.nome as item_nome,
  ci.rodada, ci.quantidade_sistema, ci.quantidade_contada, ci.divergencia,
  ci.emprestado_em_aberto, ci.nao_listado, ci.recontagem_pendente,
  ci.contado_por, ci.contado_em, ci.ajuste_movimentacao_id
from public.contagem_itens ci
join public.contagens c on c.id = ci.contagem_id
join public.enderecos e on e.id = ci.endereco_id
join public.itens i     on i.id = ci.item_id
order by ci.contagem_id, ci.endereco_id, ci.item_id, ci.rodada desc;

create view public.vw_contagem_divergencias
with (security_invoker = true) as
select * from public.vw_contagem_atual where divergencia <> 0;

-- ---------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------
alter table public.contagens       enable row level security;
alter table public.contagem_itens  enable row level security;
alter table public.auditoria       enable row level security;

revoke all on public.contagens, public.contagem_itens, public.auditoria,
  public.vw_contagem_atual, public.vw_contagem_divergencias from anon;

-- Ninguém escreve direto: só as funções RPC
revoke insert, update, delete on public.contagens, public.contagem_itens, public.auditoria from authenticated;
grant select on public.vw_contagem_atual, public.vw_contagem_divergencias to authenticated;

-- Contagens: todos os aprovados veem (para participar)
create policy contagens_ver on public.contagens for select to authenticated
  using ((select public.e_aprovado()));

-- Linhas contadas: professor/admin veem todas; quem contou vê as próprias
create policy contagem_itens_ver on public.contagem_itens for select to authenticated
  using (
    (select public.e_professor_ou_admin())
    or (contado_por = (select auth.uid()) and (select public.e_aprovado()))
  );

-- Auditoria: só admin
create policy auditoria_ver on public.auditoria for select to authenticated
  using ((select public.e_admin()));

-- Funções: logados chamam as RPCs; as internas ficam fechadas
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
revoke execute on function
  public._buscar_idempotente(uuid, public.tipo_movimentacao, uuid),
  public._carregar_item(uuid, numeric, boolean, boolean),
  public._validar_endereco(uuid, boolean),
  public._saldo_somar(uuid, uuid, numeric),
  public._saldo_subtrair(uuid, uuid, numeric),
  public._proximo_codigo(text),
  public._notificar(uuid, text, text, text, text, uuid),
  public._notificar_equipe(text, text, text, text, uuid),
  public._mudar_status_pedido(uuid, public.status_pedido, text),
  public._enderecos_da_contagem(uuid)
from authenticated;
