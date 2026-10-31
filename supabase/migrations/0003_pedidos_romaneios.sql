-- =====================================================================
-- 0003_pedidos_romaneios.sql: Bloco 4
-- Pedidos, romaneios, histórico, notificações e funções RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.status_pedido as enum
  ('rascunho', 'enviado', 'aprovado', 'rejeitado', 'separado', 'entregue', 'concluido', 'cancelado');

create type public.status_romaneio as enum
  ('gerado', 'em_separacao', 'separado', 'entregue', 'cancelado');

-- ---------------------------------------------------------------------
-- CÓDIGOS ANUAIS (PED-2026-0001, ROM-2026-0001; o Bloco 5 reaproveita para CNT)
-- ---------------------------------------------------------------------
create table public.contadores_codigo (
  prefixo text not null,
  ano     int  not null,
  ultimo  int  not null default 0,
  primary key (prefixo, ano)
);
alter table public.contadores_codigo enable row level security;
revoke all on public.contadores_codigo from anon, authenticated;

create function public._proximo_codigo(p_prefixo text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_ano int := extract(year from public.hoje_br())::int;
  v_n   int;
begin
  insert into public.contadores_codigo as c (prefixo, ano, ultimo)
  values (p_prefixo, v_ano, 1)
  on conflict (prefixo, ano) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_n;
  return p_prefixo || '-' || v_ano || '-' || lpad(v_n::text, 4, '0');
end $$;

-- Trigger genérico: o prefixo vem como argumento do trigger
create function public.gerar_codigo_anual()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;            -- código definitivo nunca muda
    return new;
  end if;
  new.codigo := public._proximo_codigo(tg_argv[0]);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------
create table public.pedidos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique default '',
  solicitante_id     uuid not null references public.perfis(id) on delete restrict,
  finalidade         text not null,
  projeto_turma      text,
  status             public.status_pedido not null default 'rascunho',
  aprovado_por       uuid references public.perfis(id),
  aprovado_em        timestamptz,
  motivo_rejeicao    text,
  chave_idempotencia uuid unique,              -- criação offline sem duplicar
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index pedidos_status_idx      on public.pedidos (status);
create index pedidos_solicitante_idx on public.pedidos (solicitante_id);

create trigger pedidos_codigo
  before insert or update on public.pedidos
  for each row execute function public.gerar_codigo_anual('PED');

create table public.pedido_itens (
  id                    uuid primary key default gen_random_uuid(),
  pedido_id             uuid not null references public.pedidos(id) on delete cascade,
  item_id               uuid not null references public.itens(id) on delete restrict,
  quantidade_solicitada numeric(12,3) not null check (quantidade_solicitada > 0),
  quantidade_aprovada   numeric(12,3) check (quantidade_aprovada >= 0),
  observacao            text,
  unique (pedido_id, item_id)
);

create table public.pedido_historico (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  status_anterior public.status_pedido,
  status_novo     public.status_pedido not null,
  usuario_id      uuid references public.perfis(id),
  comentario      text,
  criado_em       timestamptz not null default now()
);
create index pedido_historico_idx on public.pedido_historico (pedido_id, criado_em);

-- ---------------------------------------------------------------------
-- ROMANEIOS
-- ---------------------------------------------------------------------
create table public.romaneios (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique default '',
  pedido_id      uuid references public.pedidos(id) on delete restrict,  -- nulo = avulso
  descricao      text,
  status         public.status_romaneio not null default 'gerado',
  criado_por     uuid not null references public.perfis(id),
  separado_por   uuid references public.perfis(id),
  separado_em    timestamptz,
  recebido_por   uuid references public.perfis(id),
  entregue_em    timestamptz,
  aceite_em      timestamptz,
  prazo_devolucao date,                       -- opcional, vale para emprestáveis
  chave_entrega  uuid unique,                 -- entrega offline sem duplicar
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Um pedido só tem um romaneio ativo por vez
create unique index romaneios_pedido_ativo
  on public.romaneios (pedido_id)
  where pedido_id is not null and status <> 'cancelado';

create trigger romaneios_codigo
  before insert or update on public.romaneios
  for each row execute function public.gerar_codigo_anual('ROM');

create table public.romaneio_itens (
  id                   uuid primary key default gen_random_uuid(),
  romaneio_id          uuid not null references public.romaneios(id) on delete cascade,
  pedido_item_id       uuid references public.pedido_itens(id) on delete set null,
  item_id              uuid not null references public.itens(id) on delete restrict,
  endereco_retirada_id uuid not null references public.enderecos(id) on delete restrict,
  quantidade           numeric(12,3) not null check (quantidade > 0),
  separado             boolean not null default false,
  quantidade_conferida numeric(12,3) check (quantidade_conferida >= 0),
  movimentacao_id      uuid references public.movimentacoes(id) on delete restrict
);
create index romaneio_itens_idx on public.romaneio_itens (romaneio_id);

-- Agora que romaneios existe, o ledger ganha a chave estrangeira
alter table public.movimentacoes
  add constraint movimentacoes_romaneio_fk
  foreign key (romaneio_id) references public.romaneios(id) on delete restrict;

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES simples (in-app)
-- ---------------------------------------------------------------------
create table public.notificacoes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.perfis(id) on delete cascade,
  titulo             text not null,
  mensagem           text,
  tipo               text,
  referencia_tabela  text,
  referencia_id      uuid,
  lida               boolean not null default false,
  criado_em          timestamptz not null default now()
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, lida, criado_em desc);

-- ---------------------------------------------------------------------
-- FUNÇÕES INTERNAS
-- ---------------------------------------------------------------------
create function public._notificar(
  p_usuario uuid, p_titulo text, p_mensagem text,
  p_tipo text, p_ref_tabela text, p_ref_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_tabela, referencia_id)
  values (p_usuario, p_titulo, p_mensagem, p_tipo, p_ref_tabela, p_ref_id);
end $$;

create function public._notificar_equipe(
  p_titulo text, p_mensagem text, p_tipo text, p_ref_tabela text, p_ref_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_tabela, referencia_id)
  select p.id, p_titulo, p_mensagem, p_tipo, p_ref_tabela, p_ref_id
    from public.perfis p
   where p.perfil in ('professor', 'admin') and p.status_cadastro = 'aprovado';
end $$;

-- Muda o status do pedido e grava o histórico
create function public._mudar_status_pedido(
  p_pedido uuid, p_novo public.status_pedido, p_comentario text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ant public.status_pedido;
begin
  select status into v_ant from public.pedidos where id = p_pedido for update;
  update public.pedidos set status = p_novo, atualizado_em = now() where id = p_pedido;
  insert into public.pedido_historico (pedido_id, status_anterior, status_novo, usuario_id, comentario)
  values (p_pedido, v_ant, p_novo, auth.uid(), p_comentario);
end $$;

-- ---------------------------------------------------------------------
-- RPC: SALVAR PEDIDO (cria ou edita rascunho; idempotente na criação)
-- p_itens = [{"item_id": "...", "quantidade": 2, "observacao": "..."}]
-- ---------------------------------------------------------------------
create function public.salvar_pedido(
  p_chave_idempotencia uuid, p_finalidade text, p_itens jsonb,
  p_projeto_turma text default null, p_enviar boolean default false,
  p_pedido_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ped public.pedidos;
  r record;
begin
  if v_uid is null or not public.e_aprovado() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;
  if length(btrim(coalesce(p_finalidade, ''))) = 0 then
    raise exception 'Informe a finalidade do pedido.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa de pelo menos um item.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_chave_idempotencia::text, 3));

  if p_pedido_id is null then
    select * into v_ped from public.pedidos where chave_idempotencia = p_chave_idempotencia;
    if v_ped.id is not null then
      if v_ped.solicitante_id <> v_uid then
        raise exception 'Esta chave de idempotência já foi usada.';
      end if;
      return jsonb_build_object('pedido_id', v_ped.id, 'codigo', v_ped.codigo,
                                'status', v_ped.status, 'duplicada', true);
    end if;

    insert into public.pedidos (solicitante_id, finalidade, projeto_turma, chave_idempotencia)
    values (v_uid, btrim(p_finalidade), p_projeto_turma, p_chave_idempotencia)
    returning * into v_ped;

    insert into public.pedido_historico (pedido_id, status_anterior, status_novo, usuario_id)
    values (v_ped.id, null, 'rascunho', v_uid);
  else
    select * into v_ped from public.pedidos where id = p_pedido_id for update;
    if v_ped.id is null or v_ped.solicitante_id <> v_uid then
      raise exception 'Pedido não encontrado.';
    end if;
    if v_ped.status <> 'rascunho' then
      raise exception 'Só é possível editar pedidos em rascunho.';
    end if;
    update public.pedidos
       set finalidade = btrim(p_finalidade), projeto_turma = p_projeto_turma, atualizado_em = now()
     where id = v_ped.id;
    delete from public.pedido_itens where pedido_id = v_ped.id;
  end if;

  if (select count(*) <> count(distinct x.item_id)
        from jsonb_to_recordset(p_itens) as x(item_id uuid, quantidade numeric, observacao text)) then
    raise exception 'Há itens repetidos no pedido.';
  end if;

  for r in select * from jsonb_to_recordset(p_itens)
           as x(item_id uuid, quantidade numeric, observacao text)
  loop
    perform public._carregar_item(r.item_id, r.quantidade);
    insert into public.pedido_itens (pedido_id, item_id, quantidade_solicitada, observacao)
    values (v_ped.id, r.item_id, r.quantidade, r.observacao);
  end loop;

  if p_enviar then
    perform public._mudar_status_pedido(v_ped.id, 'enviado', null);
    perform public._notificar_equipe('Novo pedido',
      'Pedido ' || v_ped.codigo || ' aguardando aprovação.', 'pedido', 'pedidos', v_ped.id);
    v_ped.status := 'enviado';
  end if;

  return jsonb_build_object('pedido_id', v_ped.id, 'codigo', v_ped.codigo,
                            'status', v_ped.status, 'duplicada', false);
end $$;

-- Envia um rascunho já salvo
create function public.enviar_pedido(p_pedido_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ped public.pedidos;
begin
  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if v_uid is null or v_ped.id is null or v_ped.solicitante_id <> v_uid then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_ped.status <> 'rascunho' then
    raise exception 'Só rascunhos podem ser enviados.';
  end if;
  if not exists (select 1 from public.pedido_itens where pedido_id = v_ped.id) then
    raise exception 'O pedido precisa de pelo menos um item.';
  end if;

  perform public._mudar_status_pedido(v_ped.id, 'enviado', null);
  perform public._notificar_equipe('Novo pedido',
    'Pedido ' || v_ped.codigo || ' aguardando aprovação.', 'pedido', 'pedidos', v_ped.id);
  return jsonb_build_object('pedido_id', v_ped.id, 'status', 'enviado');
end $$;

-- ---------------------------------------------------------------------
-- RPC: APROVAR / REJEITAR (professor pode alterar quantidades)
-- p_quantidades = [{"pedido_item_id": "...", "quantidade": 1}]  (0 remove o item)
-- ---------------------------------------------------------------------
create function public.decidir_pedido(
  p_pedido_id uuid, p_aprovar boolean, p_motivo text default null,
  p_quantidades jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_ped   public.pedidos;
  v_item  uuid;
  v_total numeric;
  r record;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if v_ped.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_ped.status <> 'enviado' then
    raise exception 'Só pedidos enviados podem ser aprovados ou rejeitados.';
  end if;

  if not p_aprovar then
    if length(btrim(coalesce(p_motivo, ''))) = 0 then
      raise exception 'Informe o motivo da rejeição.';
    end if;
    update public.pedidos set motivo_rejeicao = p_motivo where id = v_ped.id;
    perform public._mudar_status_pedido(v_ped.id, 'rejeitado', p_motivo);
    perform public._notificar(v_ped.solicitante_id, 'Pedido rejeitado',
      'Pedido ' || v_ped.codigo || ' rejeitado: ' || p_motivo, 'pedido', 'pedidos', v_ped.id);
    return jsonb_build_object('pedido_id', v_ped.id, 'status', 'rejeitado');
  end if;

  update public.pedido_itens set quantidade_aprovada = quantidade_solicitada where pedido_id = v_ped.id;

  if p_quantidades is not null then
    for r in select * from jsonb_to_recordset(p_quantidades) as x(pedido_item_id uuid, quantidade numeric)
    loop
      select pit.item_id into v_item
        from public.pedido_itens pit
       where pit.id = r.pedido_item_id and pit.pedido_id = v_ped.id;
      if v_item is null then
        raise exception 'Item de pedido inválido.';
      end if;
      perform public._carregar_item(v_item, r.quantidade, false, true);
      update public.pedido_itens set quantidade_aprovada = r.quantidade where id = r.pedido_item_id;
    end loop;
  end if;

  select coalesce(sum(quantidade_aprovada), 0) into v_total
    from public.pedido_itens where pedido_id = v_ped.id;
  if v_total <= 0 then
    raise exception 'Aprove pelo menos um item (ou rejeite o pedido).';
  end if;

  update public.pedidos set aprovado_por = v_uid, aprovado_em = now() where id = v_ped.id;
  perform public._mudar_status_pedido(v_ped.id, 'aprovado', p_motivo);
  perform public._notificar(v_ped.solicitante_id, 'Pedido aprovado',
    'Pedido ' || v_ped.codigo || ' aprovado.', 'pedido', 'pedidos', v_ped.id);
  return jsonb_build_object('pedido_id', v_ped.id, 'status', 'aprovado');
end $$;

-- ---------------------------------------------------------------------
-- RPC: CANCELAR PEDIDO
-- ---------------------------------------------------------------------
create function public.cancelar_pedido(p_pedido_id uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ped public.pedidos;
  v_ok  boolean;
begin
  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if v_uid is null or v_ped.id is null then
    raise exception 'Pedido não encontrado.';
  end if;

  v_ok := (v_ped.solicitante_id = v_uid and v_ped.status in ('rascunho', 'enviado'))
       or (public.e_professor_ou_admin()
           and v_ped.status in ('rascunho', 'enviado', 'aprovado', 'separado'));
  if not v_ok then
    raise exception 'Você não pode cancelar este pedido.';
  end if;

  update public.romaneios set status = 'cancelado', atualizado_em = now()
   where pedido_id = v_ped.id and status not in ('entregue', 'cancelado');

  perform public._mudar_status_pedido(v_ped.id, 'cancelado', p_motivo);
  if v_ped.solicitante_id <> v_uid then
    perform public._notificar(v_ped.solicitante_id, 'Pedido cancelado',
      'Pedido ' || v_ped.codigo || ' foi cancelado.', 'pedido', 'pedidos', v_ped.id);
  end if;
  return jsonb_build_object('pedido_id', v_ped.id, 'status', 'cancelado');
end $$;

-- ---------------------------------------------------------------------
-- RPC: GERAR ROMANEIO de um pedido aprovado
-- Escolhe os endereços com mais saldo primeiro (menos paradas na separação).
-- Obs.: o saldo NÃO é reservado: só é baixado na entrega.
-- ---------------------------------------------------------------------
create function public.gerar_romaneio_do_pedido(
  p_pedido_id uuid, p_prazo_devolucao date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_ped  public.pedidos;
  v_rom  public.romaneios;
  v_item public.itens;
  v_rest numeric;
  v_take numeric;
  pit record;
  s  record;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if v_ped.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_ped.status <> 'aprovado' then
    raise exception 'Só pedidos aprovados geram romaneio.';
  end if;
  if exists (select 1 from public.romaneios
              where pedido_id = v_ped.id and status <> 'cancelado') then
    raise exception 'Este pedido já tem um romaneio ativo.';
  end if;

  insert into public.romaneios (pedido_id, descricao, criado_por, prazo_devolucao)
  values (v_ped.id, 'Pedido ' || v_ped.codigo, v_uid, p_prazo_devolucao)
  returning * into v_rom;

  for pit in select * from public.pedido_itens
             where pedido_id = v_ped.id and coalesce(quantidade_aprovada, 0) > 0
             order by id
  loop
    select * into v_item from public.itens where id = pit.item_id;
    v_rest := pit.quantidade_aprovada;

    for s in select sp.endereco_id, sp.quantidade_atual
               from public.saldos_por_endereco sp
               join public.enderecos e on e.id = sp.endereco_id
              where sp.item_id = pit.item_id and sp.quantidade_atual > 0
              order by sp.quantidade_atual desc, e.codigo
    loop
      v_take := least(v_rest, s.quantidade_atual);
      insert into public.romaneio_itens (romaneio_id, pedido_item_id, item_id, endereco_retirada_id, quantidade)
      values (v_rom.id, pit.id, pit.item_id, s.endereco_id, v_take);
      v_rest := v_rest - v_take;
      exit when v_rest <= 0;
    end loop;

    if v_rest > 0 then
      raise exception 'Saldo insuficiente de % (faltam %).', v_item.codigo, v_rest;
    end if;
  end loop;

  return jsonb_build_object('romaneio_id', v_rom.id, 'codigo', v_rom.codigo);
end $$;

-- ---------------------------------------------------------------------
-- RPC: ROMANEIO AVULSO (ex.: kit para competição)
-- p_itens = [{"item_id": "...", "endereco_id": "...", "quantidade": 2}]
-- ---------------------------------------------------------------------
create function public.gerar_romaneio_avulso(
  p_descricao text, p_itens jsonb, p_prazo_devolucao date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_rom   public.romaneios;
  v_saldo numeric;
  r record;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if length(btrim(coalesce(p_descricao, ''))) = 0 then
    raise exception 'Informe a descrição do romaneio.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O romaneio precisa de pelo menos um item.';
  end if;

  insert into public.romaneios (descricao, criado_por, prazo_devolucao)
  values (btrim(p_descricao), v_uid, p_prazo_devolucao)
  returning * into v_rom;

  for r in select * from jsonb_to_recordset(p_itens)
           as x(item_id uuid, endereco_id uuid, quantidade numeric)
  loop
    perform public._carregar_item(r.item_id, r.quantidade);
    perform public._validar_endereco(r.endereco_id, false);

    select coalesce(sum(quantidade), 0) into v_saldo
      from public.romaneio_itens
     where romaneio_id = v_rom.id and item_id = r.item_id and endereco_retirada_id = r.endereco_id;
    if coalesce((select quantidade_atual from public.saldos_por_endereco
                  where item_id = r.item_id and endereco_id = r.endereco_id), 0) < r.quantidade + v_saldo then
      raise exception 'Saldo insuficiente no endereço escolhido.';
    end if;

    insert into public.romaneio_itens (romaneio_id, item_id, endereco_retirada_id, quantidade)
    values (v_rom.id, r.item_id, r.endereco_id, r.quantidade);
  end loop;

  return jsonb_build_object('romaneio_id', v_rom.id, 'codigo', v_rom.codigo);
end $$;

-- ---------------------------------------------------------------------
-- RPC: CHECKLIST DE SEPARAÇÃO
-- ---------------------------------------------------------------------
create function public.marcar_item_separado(
  p_romaneio_item_id uuid, p_separado boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rom_id uuid;
  v_rom    public.romaneios;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select romaneio_id into v_rom_id from public.romaneio_itens where id = p_romaneio_item_id;
  select * into v_rom from public.romaneios where id = v_rom_id for update;
  if v_rom.id is null then
    raise exception 'Item de romaneio não encontrado.';
  end if;
  if v_rom.status not in ('gerado', 'em_separacao') then
    raise exception 'A separação deste romaneio já foi encerrada ou cancelada.';
  end if;

  update public.romaneio_itens set separado = p_separado where id = p_romaneio_item_id;
  if v_rom.status = 'gerado' then
    update public.romaneios set status = 'em_separacao', atualizado_em = now() where id = v_rom.id;
  end if;
  return jsonb_build_object('romaneio_item_id', p_romaneio_item_id, 'separado', p_separado);
end $$;

create function public.concluir_separacao(p_romaneio_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rom public.romaneios;
  v_ped public.pedidos;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_rom from public.romaneios where id = p_romaneio_id for update;
  if v_rom.id is null then
    raise exception 'Romaneio não encontrado.';
  end if;
  if v_rom.status not in ('gerado', 'em_separacao') then
    raise exception 'A separação deste romaneio já foi encerrada ou cancelada.';
  end if;
  if exists (select 1 from public.romaneio_itens where romaneio_id = v_rom.id and not separado) then
    raise exception 'Ainda há itens sem separar.';
  end if;

  update public.romaneios
     set status = 'separado', separado_por = v_uid, separado_em = now(), atualizado_em = now()
   where id = v_rom.id;

  if v_rom.pedido_id is not null then
    select * into v_ped from public.pedidos where id = v_rom.pedido_id for update;
    if v_ped.status = 'aprovado' then
      perform public._mudar_status_pedido(v_ped.id, 'separado', null);
      perform public._notificar(v_ped.solicitante_id, 'Pedido separado',
        'Pedido ' || v_ped.codigo || ' está separado e pronto para retirada.',
        'pedido', 'pedidos', v_ped.id);
    end if;
  end if;
  return jsonb_build_object('romaneio_id', v_rom.id, 'status', 'separado');
end $$;

create function public.cancelar_romaneio(p_romaneio_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rom public.romaneios;
  v_ped public.pedidos;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_rom from public.romaneios where id = p_romaneio_id for update;
  if v_rom.id is null then
    raise exception 'Romaneio não encontrado.';
  end if;
  if v_rom.status in ('entregue', 'cancelado') then
    raise exception 'Este romaneio não pode mais ser cancelado.';
  end if;

  update public.romaneios set status = 'cancelado', atualizado_em = now() where id = v_rom.id;

  if v_rom.pedido_id is not null then
    select * into v_ped from public.pedidos where id = v_rom.pedido_id for update;
    if v_ped.status = 'separado' then
      perform public._mudar_status_pedido(v_ped.id, 'aprovado', 'Romaneio cancelado');
    end if;
  end if;
  return jsonb_build_object('romaneio_id', v_rom.id, 'status', 'cancelado');
end $$;

-- ---------------------------------------------------------------------
-- RPC: ENTREGAR ROMANEIO
-- Consumíveis geram saída; emprestáveis geram empréstimo para quem recebe.
-- p_conferencias (opcional) = [{"romaneio_item_id": "...", "quantidade_conferida": 1}]
-- Sem conferência informada, considera-se conferido tudo. Entrega só o conferido.
-- Tudo na mesma transação: se um item falhar, nada é baixado.
-- ---------------------------------------------------------------------
create function public.entregar_romaneio(
  p_romaneio_id uuid, p_recebido_por uuid, p_chave_idempotencia uuid,
  p_conferencias jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_rom       public.romaneios;
  v_item      public.itens;
  v_ped       public.pedidos;
  v_conf      numeric;
  v_c         numeric;
  v_chave     uuid;
  v_res       jsonb;
  v_emprestou boolean := false;
  v_entregou  numeric := 0;
  r record;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_romaneio_id::text, 2));
  select * into v_rom from public.romaneios where id = p_romaneio_id for update;
  if v_rom.id is null then
    raise exception 'Romaneio não encontrado.';
  end if;

  if v_rom.status = 'entregue' then
    if v_rom.chave_entrega = p_chave_idempotencia then
      return jsonb_build_object('romaneio_id', v_rom.id, 'status', 'entregue', 'duplicada', true);
    end if;
    raise exception 'Este romaneio já foi entregue.';
  end if;
  if v_rom.status <> 'separado' then
    raise exception 'O romaneio precisa estar separado antes da entrega.';
  end if;
  if not exists (select 1 from public.perfis p
                  where p.id = p_recebido_por and p.status_cadastro = 'aprovado') then
    raise exception 'Responsável pelo recebimento inválido ou não aprovado.';
  end if;

  -- ordem por item evita deadlock entre entregas simultâneas
  for r in select ri.*
             from public.romaneio_itens ri
             join public.enderecos e on e.id = ri.endereco_retirada_id
            where ri.romaneio_id = v_rom.id
            order by ri.item_id, e.codigo, ri.id
  loop
    v_conf := r.quantidade;
    if p_conferencias is not null then
      select (x ->> 'quantidade_conferida')::numeric into v_c
        from jsonb_array_elements(p_conferencias) x
       where (x ->> 'romaneio_item_id')::uuid = r.id;
      if v_c is not null then
        v_conf := v_c;
      end if;
    end if;
    if v_conf < 0 or v_conf > r.quantidade then
      raise exception 'Quantidade conferida inválida (máximo %).', r.quantidade;
    end if;

    update public.romaneio_itens set quantidade_conferida = v_conf where id = r.id;

    if v_conf > 0 then
      select * into v_item from public.itens where id = r.item_id;
      v_chave := md5(p_chave_idempotencia::text || r.id::text)::uuid;

      if v_item.tipo_controle = 'consumivel' then
        v_res := public.registrar_saida(
          r.item_id, r.endereco_retirada_id, v_conf, v_chave,
          'Romaneio ' || v_rom.codigo, v_rom.id);
      else
        v_res := public.emprestar(
          r.item_id, r.endereco_retirada_id, p_recebido_por, v_conf, v_chave,
          v_rom.prazo_devolucao, 'Romaneio ' || v_rom.codigo, v_rom.id);
        v_emprestou := true;
      end if;

      update public.romaneio_itens
         set movimentacao_id = (v_res ->> 'movimentacao_id')::uuid
       where id = r.id;
      v_entregou := v_entregou + v_conf;
    end if;
  end loop;

  if v_entregou = 0 then
    raise exception 'Nada conferido para entregar.';
  end if;

  update public.romaneios
     set status = 'entregue', recebido_por = p_recebido_por, entregue_em = now(),
         aceite_em = now(), chave_entrega = p_chave_idempotencia, atualizado_em = now()
   where id = v_rom.id;

  if v_rom.pedido_id is not null then
    select * into v_ped from public.pedidos where id = v_rom.pedido_id for update;
    perform public._mudar_status_pedido(v_ped.id, 'entregue', null);
    -- sem empréstimos para devolver, o pedido já está concluído
    if not v_emprestou then
      perform public._mudar_status_pedido(v_ped.id, 'concluido', 'Somente consumíveis entregues');
    end if;
    perform public._notificar(v_ped.solicitante_id, 'Pedido entregue',
      'Pedido ' || v_ped.codigo || ' foi entregue.', 'pedido', 'pedidos', v_ped.id);
  end if;

  return jsonb_build_object('romaneio_id', v_rom.id, 'status', 'entregue',
                            'emprestimos_criados', v_emprestou, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: CONCLUIR PEDIDO (depois que os empréstimos voltaram)
-- ---------------------------------------------------------------------
create function public.concluir_pedido(p_pedido_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ped public.pedidos;
begin
  if auth.uid() is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if v_ped.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_ped.status <> 'entregue' then
    raise exception 'Só pedidos entregues podem ser concluídos.';
  end if;
  if exists (
    select 1
      from public.movimentacoes m
      join public.romaneios r   on r.id = m.romaneio_id
      join public.emprestimos e on e.id = m.emprestimo_id
     where r.pedido_id = v_ped.id
       and m.tipo = 'emprestimo'
       and e.status in ('em_aberto', 'devolvido_parcial')
  ) then
    raise exception 'Ainda há empréstimos em aberto deste pedido.';
  end if;

  perform public._mudar_status_pedido(v_ped.id, 'concluido', null);
  return jsonb_build_object('pedido_id', v_ped.id, 'status', 'concluido');
end $$;

-- ---------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------
alter table public.pedidos          enable row level security;
alter table public.pedido_itens     enable row level security;
alter table public.pedido_historico enable row level security;
alter table public.romaneios        enable row level security;
alter table public.romaneio_itens   enable row level security;
alter table public.notificacoes     enable row level security;

revoke all on public.pedidos, public.pedido_itens, public.pedido_historico,
  public.romaneios, public.romaneio_itens, public.notificacoes from anon;

-- Ninguém escreve direto: só as funções RPC
revoke insert, update, delete on public.pedidos, public.pedido_itens, public.pedido_historico,
  public.romaneios, public.romaneio_itens, public.notificacoes from authenticated;
-- exceção: o usuário pode marcar a própria notificação como lida
grant update (lida) on public.notificacoes to authenticated;

-- pedidos: o dono vê os seus; professor/admin veem todos
create policy pedidos_ver on public.pedidos for select to authenticated
  using (
    (select public.e_professor_ou_admin())
    or (solicitante_id = (select auth.uid()) and (select public.e_aprovado()))
  );

-- filhos do pedido seguem a visibilidade do pedido (a RLS de pedidos vale na subconsulta)
create policy pedido_itens_ver on public.pedido_itens for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));
create policy pedido_historico_ver on public.pedido_historico for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));

-- romaneios: professor/admin veem todos; aluno vê os dos próprios pedidos
create policy romaneios_ver on public.romaneios for select to authenticated
  using (
    (select public.e_professor_ou_admin())
    or (pedido_id is not null and exists (select 1 from public.pedidos p where p.id = pedido_id))
  );
create policy romaneio_itens_ver on public.romaneio_itens for select to authenticated
  using (exists (select 1 from public.romaneios r where r.id = romaneio_id));

-- notificações: só as próprias
create policy notificacoes_ver on public.notificacoes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy notificacoes_marcar_lida on public.notificacoes for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

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
  public._mudar_status_pedido(uuid, public.status_pedido, text)
from authenticated;
