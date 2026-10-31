-- =====================================================================
-- 0005_trocas_qr.sql: Bloco 8A (endereços)
-- Troca de QR: quando um endereço muda de lugar (ex.: uma caixa vai para outra gaveta),
-- o código dele (que mostra o caminho) muda. Como códigos são definitivos, o sistema cria
-- um endereço NOVO (com tudo que tem dentro), transfere o estoque, desativa o antigo e abre
-- uma requisição para professor/admin trocarem as etiquetas.
-- =====================================================================

create type public.status_troca_qr as enum ('pendente', 'concluida');

-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------
create table public.trocas_qr (
  id                 uuid primary key default gen_random_uuid(),
  endereco_antigo_id uuid not null references public.enderecos(id) on delete restrict,
  endereco_novo_id   uuid not null references public.enderecos(id) on delete restrict,
  motivo             text,
  status             public.status_troca_qr not null default 'pendente',
  criado_por         uuid not null references public.perfis(id),
  criado_em          timestamptz not null default now(),
  concluida_por      uuid references public.perfis(id),
  concluida_em       timestamptz,
  check ((status = 'concluida') = (concluida_em is not null))
);
create index trocas_qr_status_idx on public.trocas_qr (status, criado_em desc);

-- Uma linha por endereço que ganhou código novo (a raiz movida e tudo que estava dentro)
create table public.trocas_qr_etiquetas (
  id                 uuid primary key default gen_random_uuid(),
  troca_id           uuid not null references public.trocas_qr(id) on delete cascade
                       deferrable initially deferred,
  endereco_antigo_id uuid not null references public.enderecos(id) on delete restrict,
  endereco_novo_id   uuid not null references public.enderecos(id) on delete restrict
);
create index trocas_qr_etiquetas_idx on public.trocas_qr_etiquetas (troca_id);

-- ---------------------------------------------------------------------
-- PROTEÇÃO DOS ENDEREÇOS (vale para qualquer escrita, inclusive a feita pela tela)
-- ---------------------------------------------------------------------
create function public.proteger_endereco()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.substituido_por_id is not null then
      raise exception 'A troca de QR só pode ser feita pela função mover_endereco.';
    end if;
    if new.pai_id is not null
       and not coalesce((select e.ativo from public.enderecos e where e.id = new.pai_id), false) then
      raise exception 'Não é possível criar dentro de um endereço inativo.';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.substituido_por_id is distinct from old.substituido_por_id
     and coalesce(current_setting('app.movendo_endereco', true), '') <> 'on' then
    raise exception 'A troca de QR só pode ser feita pela função mover_endereco.';
  end if;

  if not old.ativo and new.ativo and old.substituido_por_id is not null then
    raise exception 'Este endereço foi substituído (troca de QR) e não pode ser reativado.';
  end if;

  if old.ativo and not new.ativo then
    if exists (select 1 from public.enderecos f where f.pai_id = old.id and f.ativo) then
      raise exception 'Desative antes os endereços que estão dentro deste.';
    end if;
    if exists (select 1 from public.saldos_por_endereco s
                where s.endereco_id = old.id and s.quantidade_atual > 0) then
      raise exception 'Há estoque neste endereço: transfira os itens antes de desativar.';
    end if;
  end if;

  if new.ativo and not old.ativo and old.pai_id is not null
     and not coalesce((select e.ativo from public.enderecos e where e.id = old.pai_id), false) then
    raise exception 'Reative primeiro o endereço de fora.';
  end if;

  return new;
end $$;

create trigger enderecos_protecao
  before insert or update on public.enderecos
  for each row execute function public.proteger_endereco();

-- ---------------------------------------------------------------------
-- FUNÇÃO INTERNA: copia um endereço (e o que tem dentro) para um novo pai
-- ---------------------------------------------------------------------
create function public._clonar_endereco(
  p_antigo uuid, p_novo_pai uuid, p_troca uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old  public.enderecos;
  v_novo uuid;
  r      record;
begin
  select * into v_old from public.enderecos where id = p_antigo;

  insert into public.enderecos (tipo_endereco_id, pai_id, nome, descricao)
  values (v_old.tipo_endereco_id, p_novo_pai, v_old.nome, v_old.descricao)
  returning id into v_novo;

  insert into public.trocas_qr_etiquetas (troca_id, endereco_antigo_id, endereco_novo_id)
  values (p_troca, p_antigo, v_novo);

  -- estoque: sai do antigo e entra no novo (fica no ledger como transferência)
  for r in
    select s.item_id, s.quantidade_atual
      from public.saldos_por_endereco s
     where s.endereco_id = p_antigo and s.quantidade_atual > 0
  loop
    perform public.transferir(r.item_id, p_antigo, v_novo, r.quantidade_atual,
                              gen_random_uuid(), p_motivo);
  end loop;

  -- o que está dentro vai junto (mantém a ordem)
  for r in
    select f.id from public.enderecos f where f.pai_id = p_antigo and f.ativo order by f.numero
  loop
    perform public._clonar_endereco(r.id, v_novo, p_troca, p_motivo);
  end loop;

  update public.enderecos
     set ativo = false, substituido_por_id = v_novo
   where id = p_antigo;

  return v_novo;
end $$;

-- ---------------------------------------------------------------------
-- RPC: MOVER ENDEREÇO (professor/admin) = troca de QR
-- ---------------------------------------------------------------------
create function public.mover_endereco(
  p_endereco_id uuid, p_novo_pai_id uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_end     public.enderecos;
  v_cod     text;
  v_troca   uuid := gen_random_uuid();
  v_novo    uuid;
  v_cod_novo text;
  v_qtd_end int;
  v_qtd_sal int;
  v_motivo  text;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_end from public.enderecos where id = p_endereco_id for update;
  if v_end.id is null then raise exception 'Endereço não encontrado.'; end if;
  if not v_end.ativo then raise exception 'Endereço inativo ou já substituído.'; end if;
  if v_end.pai_id is not distinct from p_novo_pai_id then
    raise exception 'O endereço já está nesse lugar.';
  end if;

  if p_novo_pai_id is not null then
    if not coalesce((select e.ativo from public.enderecos e where e.id = p_novo_pai_id), false) then
      raise exception 'Destino não encontrado ou inativo.';
    end if;
    if exists (
      with recursive arv as (
        select id from public.enderecos where id = p_endereco_id
        union all
        select f.id from public.enderecos f join arv on f.pai_id = arv.id
      ) select 1 from arv where id = p_novo_pai_id
    ) then
      raise exception 'Não é possível mover um endereço para dentro dele mesmo.';
    end if;
  end if;

  -- Não mexe em endereços usados por contagem ou romaneio em andamento
  with recursive arv as (
    select id from public.enderecos where id = p_endereco_id
    union all
    select f.id from public.enderecos f join arv on f.pai_id = arv.id
  )
  select c.codigo into v_cod
    from public.contagens c
   where c.status in ('aberta', 'em_andamento', 'em_revisao')
     and exists (select 1 from public._enderecos_da_contagem(c.id) as x(id)
                  where x.id in (select id from arv))
   limit 1;
  if v_cod is not null then
    raise exception 'A contagem % está em andamento e inclui este endereço. Conclua ou cancele antes de mover.', v_cod;
  end if;

  with recursive arv as (
    select id from public.enderecos where id = p_endereco_id
    union all
    select f.id from public.enderecos f join arv on f.pai_id = arv.id
  )
  select r.codigo into v_cod
    from public.romaneio_itens ri
    join public.romaneios r on r.id = ri.romaneio_id
   where r.status in ('gerado', 'em_separacao', 'separado')
     and ri.endereco_retirada_id in (select id from arv)
   limit 1;
  if v_cod is not null then
    raise exception 'O romaneio % retira itens deste endereço. Entregue ou cancele antes de mover.', v_cod;
  end if;

  v_motivo := 'Troca de QR: ' || v_end.codigo || coalesce(' (' || nullif(btrim(p_motivo), '') || ')', '');

  perform set_config('app.movendo_endereco', 'on', true);

  v_novo := public._clonar_endereco(p_endereco_id, p_novo_pai_id, v_troca, v_motivo);

  select e.codigo into v_cod_novo from public.enderecos e where e.id = v_novo;

  insert into public.trocas_qr (id, endereco_antigo_id, endereco_novo_id, motivo, criado_por)
  values (v_troca, p_endereco_id, v_novo, nullif(btrim(p_motivo), ''), v_uid);

  select count(*) into v_qtd_end from public.trocas_qr_etiquetas where troca_id = v_troca;

  perform public._notificar_equipe(
    'Trocar etiqueta de QR',
    format('%s agora é %s (%s etiqueta(s) para trocar).', v_end.codigo, v_cod_novo, v_qtd_end),
    'troca_qr', 'trocas_qr', v_troca);

  perform set_config('app.movendo_endereco', 'off', true);

  return jsonb_build_object(
    'troca_id', v_troca,
    'endereco_novo_id', v_novo,
    'codigo_antigo', v_end.codigo,
    'codigo_novo', v_cod_novo,
    'etiquetas', v_qtd_end);
end $$;

-- ---------------------------------------------------------------------
-- RPC: CONCLUIR TROCA DE QR (etiquetas trocadas no estoque)
-- ---------------------------------------------------------------------
create function public.concluir_troca_qr(p_troca_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_t   public.trocas_qr;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_t from public.trocas_qr where id = p_troca_id for update;
  if v_t.id is null then raise exception 'Troca não encontrada.'; end if;
  if v_t.status = 'concluida' then raise exception 'Esta troca já foi concluída.'; end if;

  update public.trocas_qr
     set status = 'concluida', concluida_por = v_uid, concluida_em = now()
   where id = p_troca_id;

  update public.notificacoes set lida = true
   where referencia_tabela = 'trocas_qr' and referencia_id = p_troca_id;

  return jsonb_build_object('troca_id', p_troca_id, 'status', 'concluida');
end $$;

-- ---------------------------------------------------------------------
-- VIEW: etiquetas de cada troca (código antigo -> novo)
-- ---------------------------------------------------------------------
create view public.vw_troca_qr_etiquetas
with (security_invoker = true) as
select
  x.troca_id,
  t.status           as troca_status,
  x.endereco_antigo_id,
  o.codigo           as codigo_antigo,
  x.endereco_novo_id,
  n.codigo           as codigo_novo,
  n.nome,
  tp.nome            as tipo_nome,
  tp.nivel           as tipo_nivel
from public.trocas_qr_etiquetas x
join public.trocas_qr t on t.id = x.troca_id
join public.enderecos o on o.id = x.endereco_antigo_id
join public.enderecos n on n.id = x.endereco_novo_id
join public.tipos_endereco tp on tp.id = n.tipo_endereco_id;

-- ---------------------------------------------------------------------
-- AUDITORIA, RLS E PERMISSÕES
-- ---------------------------------------------------------------------
create trigger auditoria_trocas_qr after insert or update or delete on public.trocas_qr
  for each row execute function public.registrar_auditoria();

alter table public.trocas_qr           enable row level security;
alter table public.trocas_qr_etiquetas enable row level security;

revoke all on public.trocas_qr, public.trocas_qr_etiquetas, public.vw_troca_qr_etiquetas from anon;
revoke insert, update, delete on public.trocas_qr, public.trocas_qr_etiquetas from authenticated;
grant select on public.vw_troca_qr_etiquetas to authenticated;

create policy trocas_qr_ver on public.trocas_qr for select to authenticated
  using ((select public.e_professor_ou_admin()));
create policy trocas_qr_etiquetas_ver on public.trocas_qr_etiquetas for select to authenticated
  using ((select public.e_professor_ou_admin()));

revoke execute on function
  public.mover_endereco(uuid, uuid, text),
  public.concluir_troca_qr(uuid),
  public.proteger_endereco()
from public, anon;
grant execute on function
  public.mover_endereco(uuid, uuid, text),
  public.concluir_troca_qr(uuid)
to authenticated;
revoke execute on function public._clonar_endereco(uuid, uuid, uuid, text)
from public, anon, authenticated;
