-- =====================================================================
-- 0002_movimentacoes_emprestimos.sql: Bloco 3
-- Ledger imutável, empréstimos e funções RPC transacionais
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.tipo_movimentacao as enum
  ('entrada', 'saida', 'transferencia', 'ajuste', 'emprestimo', 'devolucao');

-- "atrasado" não é gravado: é calculado nas views pela data do prazo
create type public.status_emprestimo as enum
  ('em_aberto', 'devolvido_parcial', 'devolvido', 'perdido');

-- Data de hoje no horário de Brasília (o servidor roda em UTC)
create function public.hoje_br()
returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- ---------------------------------------------------------------------
-- EMPRESTIMOS
-- ---------------------------------------------------------------------
create table public.emprestimos (
  id                  uuid primary key default gen_random_uuid(),
  item_id             uuid not null references public.itens(id) on delete restrict,
  emprestado_para     uuid not null references public.perfis(id) on delete restrict,
  registrado_por      uuid not null references public.perfis(id) on delete restrict,
  endereco_origem_id  uuid not null references public.enderecos(id) on delete restrict,
  quantidade          numeric(12,3) not null check (quantidade > 0),
  quantidade_devolvida numeric(12,3) not null default 0 check (quantidade_devolvida >= 0),
  quantidade_perdida  numeric(12,3) not null default 0 check (quantidade_perdida >= 0),
  emprestado_em       timestamptz not null default now(),
  prazo_previsto      date,                      -- opcional
  status              public.status_emprestimo not null default 'em_aberto',
  baixado_por         uuid references public.perfis(id),
  observacao          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (quantidade_devolvida + quantidade_perdida <= quantidade)
);

create index emprestimos_status_idx on public.emprestimos (status);
create index emprestimos_pessoa_idx on public.emprestimos (emprestado_para);
create index emprestimos_prazo_idx  on public.emprestimos (prazo_previsto)
  where status in ('em_aberto', 'devolvido_parcial');

-- ---------------------------------------------------------------------
-- MOVIMENTACOES (ledger imutável)
-- Direção do ajuste: destino preenchido = aumentou; origem preenchida = diminuiu
-- romaneio_id e contagem_id ganham FK nos blocos 4 e 5 (tabelas ainda não existem)
-- ---------------------------------------------------------------------
create table public.movimentacoes (
  id                  uuid primary key default gen_random_uuid(),
  tipo                public.tipo_movimentacao not null,
  item_id             uuid not null references public.itens(id) on delete restrict,
  quantidade          numeric(12,3) not null check (quantidade > 0),
  endereco_origem_id  uuid references public.enderecos(id) on delete restrict,
  endereco_destino_id uuid references public.enderecos(id) on delete restrict,
  usuario_id          uuid not null references public.perfis(id) on delete restrict,
  motivo              text,
  emprestimo_id       uuid references public.emprestimos(id) on delete restrict,
  romaneio_id         uuid,
  contagem_id         uuid,
  chave_idempotencia  uuid not null unique,
  criado_em           timestamptz not null default now(),
  check (
    (tipo = 'entrada'       and endereco_origem_id is null     and endereco_destino_id is not null) or
    (tipo in ('saida', 'emprestimo') and endereco_origem_id is not null and endereco_destino_id is null) or
    (tipo = 'devolucao'     and endereco_origem_id is null     and endereco_destino_id is not null) or
    (tipo = 'transferencia' and endereco_origem_id is not null and endereco_destino_id is not null
                            and endereco_origem_id <> endereco_destino_id) or
    (tipo = 'ajuste'        and (endereco_origem_id is null) <> (endereco_destino_id is null))
  ),
  check ((tipo in ('emprestimo', 'devolucao')) = (emprestimo_id is not null)),
  check (tipo <> 'ajuste' or length(btrim(coalesce(motivo, ''))) > 0)
);

create index movimentacoes_item_idx   on public.movimentacoes (item_id, criado_em desc);
create index movimentacoes_data_idx   on public.movimentacoes (criado_em desc);
create index movimentacoes_emprest_idx on public.movimentacoes (emprestimo_id);

create function public.bloquear_alteracao_movimentacao()
returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Movimentações são imutáveis: não podem ser alteradas nem apagadas.';
end $$;

create trigger movimentacoes_imutavel
  before update or delete on public.movimentacoes
  for each row execute function public.bloquear_alteracao_movimentacao();

-- ---------------------------------------------------------------------
-- FUNÇÕES INTERNAS (não ficam expostas pela API)
-- ---------------------------------------------------------------------

-- Se a chave já foi usada, devolve a movimentação antiga (reenvio offline).
-- O lock serializa dois envios simultâneos da mesma chave.
create function public._buscar_idempotente(
  p_chave uuid, p_tipo public.tipo_movimentacao, p_item uuid)
returns public.movimentacoes
language plpgsql security definer set search_path = '' as $$
declare
  v public.movimentacoes;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 0));
  select * into v from public.movimentacoes where chave_idempotencia = p_chave;
  if v.id is not null and (v.tipo <> p_tipo or v.item_id <> p_item) then
    raise exception 'Esta chave de idempotência já foi usada em outra operação.';
  end if;
  return v;
end $$;

create function public._carregar_item(
  p_item_id uuid, p_quantidade numeric,
  p_exigir_ativo boolean default true, p_permitir_zero boolean default false)
returns public.itens
language plpgsql security definer set search_path = '' as $$
declare
  v public.itens;
begin
  if p_quantidade is null
     or p_quantidade < 0
     or (p_quantidade = 0 and not p_permitir_zero) then
    raise exception 'Quantidade inválida: deve ser maior que zero.';
  end if;

  select * into v from public.itens where id = p_item_id;
  if v.id is null then
    raise exception 'Item não encontrado.';
  end if;
  if p_exigir_ativo and v.status <> 'ativo' then
    raise exception 'Item inativo.';
  end if;
  if v.unidade = 'un' and p_quantidade <> trunc(p_quantidade) then
    raise exception 'Itens em unidade "un" aceitam apenas quantidade inteira.';
  end if;
  return v;
end $$;

create function public._validar_endereco(p_endereco_id uuid, p_exigir_ativo boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ativo boolean;
  v_armazena boolean;
begin
  select e.ativo, t.armazena_itens into v_ativo, v_armazena
    from public.enderecos e
    join public.tipos_endereco t on t.id = e.tipo_endereco_id
   where e.id = p_endereco_id;

  if v_armazena is null then
    raise exception 'Endereço não encontrado.';
  end if;
  if not v_armazena then
    raise exception 'Este endereço não é uma posição: itens só ficam em posições.';
  end if;
  if p_exigir_ativo and not v_ativo then
    raise exception 'Endereço inativo.';
  end if;
end $$;

create function public._saldo_somar(p_item uuid, p_endereco uuid, p_qtd numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.saldos_por_endereco as s (item_id, endereco_id, quantidade_atual)
  values (p_item, p_endereco, p_qtd)
  on conflict (item_id, endereco_id)
  do update set quantidade_atual = s.quantidade_atual + excluded.quantidade_atual;
end $$;

create function public._saldo_subtrair(p_item uuid, p_endereco uuid, p_qtd numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.saldos_por_endereco
     set quantidade_atual = quantidade_atual - p_qtd
   where item_id = p_item
     and endereco_id = p_endereco
     and quantidade_atual >= p_qtd;
  if not found then
    raise exception 'Saldo insuficiente no endereço de origem.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RPC: ENTRADA
-- ---------------------------------------------------------------------
create function public.registrar_entrada(
  p_item_id uuid, p_endereco_id uuid, p_quantidade numeric,
  p_chave_idempotencia uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_dup public.movimentacoes;
  v_id  uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'entrada', p_item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id, 'duplicada', true);
  end if;

  perform public._carregar_item(p_item_id, p_quantidade);
  perform public._validar_endereco(p_endereco_id, true);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 1));

  perform public._saldo_somar(p_item_id, p_endereco_id, p_quantidade);

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_destino_id, usuario_id, motivo, chave_idempotencia)
  values
    ('entrada', p_item_id, p_quantidade, p_endereco_id, v_uid, p_motivo, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: SAÍDA (só consumíveis: baixa definitiva)
-- ---------------------------------------------------------------------
create function public.registrar_saida(
  p_item_id uuid, p_endereco_id uuid, p_quantidade numeric,
  p_chave_idempotencia uuid, p_motivo text default null, p_romaneio_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_dup  public.movimentacoes;
  v_item public.itens;
  v_id   uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'saida', p_item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id, 'duplicada', true);
  end if;

  v_item := public._carregar_item(p_item_id, p_quantidade);
  if v_item.tipo_controle <> 'consumivel' then
    raise exception 'Item emprestável não tem saída definitiva: use empréstimo (ou ajuste, para baixa por perda).';
  end if;
  perform public._validar_endereco(p_endereco_id, false);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 1));

  perform public._saldo_subtrair(p_item_id, p_endereco_id, p_quantidade);

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_origem_id, usuario_id, motivo, romaneio_id, chave_idempotencia)
  values
    ('saida', p_item_id, p_quantidade, p_endereco_id, v_uid, p_motivo, p_romaneio_id, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: TRANSFERÊNCIA entre posições
-- ---------------------------------------------------------------------
create function public.transferir(
  p_item_id uuid, p_endereco_origem_id uuid, p_endereco_destino_id uuid,
  p_quantidade numeric, p_chave_idempotencia uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_dup public.movimentacoes;
  v_id  uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;
  if p_endereco_origem_id = p_endereco_destino_id then
    raise exception 'Origem e destino devem ser diferentes.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'transferencia', p_item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id, 'duplicada', true);
  end if;

  perform public._carregar_item(p_item_id, p_quantidade);
  perform public._validar_endereco(p_endereco_origem_id, false);
  perform public._validar_endereco(p_endereco_destino_id, true);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 1));

  perform public._saldo_subtrair(p_item_id, p_endereco_origem_id, p_quantidade);
  perform public._saldo_somar(p_item_id, p_endereco_destino_id, p_quantidade);

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_origem_id, endereco_destino_id,
     usuario_id, motivo, chave_idempotencia)
  values
    ('transferencia', p_item_id, p_quantidade, p_endereco_origem_id, p_endereco_destino_id,
     v_uid, p_motivo, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: AJUSTE (define o saldo novo de um item numa posição; motivo obrigatório)
-- ---------------------------------------------------------------------
create function public.ajustar(
  p_item_id uuid, p_endereco_id uuid, p_quantidade_nova numeric,
  p_motivo text, p_chave_idempotencia uuid, p_contagem_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_dup   public.movimentacoes;
  v_atual numeric;
  v_dif   numeric;
  v_id    uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'O motivo do ajuste é obrigatório.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'ajuste', p_item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id, 'duplicada', true);
  end if;

  perform public._carregar_item(p_item_id, p_quantidade_nova, false, true);
  perform public._validar_endereco(p_endereco_id, false);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 1));

  select s.quantidade_atual into v_atual
    from public.saldos_por_endereco s
   where s.item_id = p_item_id and s.endereco_id = p_endereco_id;
  v_atual := coalesce(v_atual, 0);
  v_dif := p_quantidade_nova - v_atual;

  if v_dif = 0 then
    raise exception 'O saldo já é este valor: nenhum ajuste necessário.';
  end if;

  insert into public.saldos_por_endereco as s (item_id, endereco_id, quantidade_atual)
  values (p_item_id, p_endereco_id, p_quantidade_nova)
  on conflict (item_id, endereco_id)
  do update set quantidade_atual = excluded.quantidade_atual;

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_origem_id, endereco_destino_id,
     usuario_id, motivo, contagem_id, chave_idempotencia)
  values
    ('ajuste', p_item_id, abs(v_dif),
     case when v_dif < 0 then p_endereco_id end,
     case when v_dif > 0 then p_endereco_id end,
     v_uid, p_motivo, p_contagem_id, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'duplicada', false,
                            'saldo_anterior', v_atual, 'saldo_novo', p_quantidade_nova);
end $$;

-- ---------------------------------------------------------------------
-- RPC: EMPRÉSTIMO (só itens emprestáveis; só professor/admin registram)
-- ---------------------------------------------------------------------
create function public.emprestar(
  p_item_id uuid, p_endereco_id uuid, p_emprestado_para uuid, p_quantidade numeric,
  p_chave_idempotencia uuid, p_prazo_previsto date default null,
  p_observacao text default null, p_romaneio_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_dup  public.movimentacoes;
  v_item public.itens;
  v_emp  uuid;
  v_id   uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'emprestimo', p_item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id,
                              'emprestimo_id', v_dup.emprestimo_id, 'duplicada', true);
  end if;

  v_item := public._carregar_item(p_item_id, p_quantidade);
  if v_item.tipo_controle <> 'emprestavel' then
    raise exception 'Só itens emprestáveis podem ser emprestados.';
  end if;
  if not exists (select 1 from public.perfis p
                  where p.id = p_emprestado_para and p.status_cadastro = 'aprovado') then
    raise exception 'Pessoa inválida ou com cadastro não aprovado.';
  end if;
  if p_prazo_previsto is not null and p_prazo_previsto < public.hoje_br() then
    raise exception 'O prazo previsto não pode estar no passado.';
  end if;
  perform public._validar_endereco(p_endereco_id, false);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 1));

  perform public._saldo_subtrair(p_item_id, p_endereco_id, p_quantidade);

  insert into public.emprestimos
    (item_id, emprestado_para, registrado_por, endereco_origem_id,
     quantidade, prazo_previsto, observacao)
  values
    (p_item_id, p_emprestado_para, v_uid, p_endereco_id,
     p_quantidade, p_prazo_previsto, p_observacao)
  returning id into v_emp;

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_origem_id, usuario_id, motivo,
     emprestimo_id, romaneio_id, chave_idempotencia)
  values
    ('emprestimo', p_item_id, p_quantidade, p_endereco_id, v_uid, p_observacao,
     v_emp, p_romaneio_id, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'emprestimo_id', v_emp, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: DEVOLUÇÃO (parcial permitida; volta para a posição escolhida)
-- ---------------------------------------------------------------------
create function public.devolver(
  p_emprestimo_id uuid, p_quantidade numeric, p_endereco_destino_id uuid,
  p_chave_idempotencia uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_dup    public.movimentacoes;
  v_emp    public.emprestimos;
  v_pend   numeric;
  v_dev    numeric;
  v_status public.status_emprestimo;
  v_id     uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  select * into v_emp from public.emprestimos where id = p_emprestimo_id;
  if v_emp.id is null then
    raise exception 'Empréstimo não encontrado.';
  end if;

  v_dup := public._buscar_idempotente(p_chave_idempotencia, 'devolucao', v_emp.item_id);
  if v_dup.id is not null then
    return jsonb_build_object('movimentacao_id', v_dup.id,
                              'emprestimo_id', v_dup.emprestimo_id, 'duplicada', true);
  end if;

  perform public._carregar_item(v_emp.item_id, p_quantidade, false);
  perform public._validar_endereco(p_endereco_destino_id, true);
  perform pg_advisory_xact_lock(hashtextextended(v_emp.item_id::text, 1));

  -- relê com trava, já dentro da serialização do item
  select * into v_emp from public.emprestimos where id = p_emprestimo_id for update;
  if v_emp.status in ('devolvido', 'perdido') then
    raise exception 'Este empréstimo já está encerrado.';
  end if;

  v_pend := v_emp.quantidade - v_emp.quantidade_devolvida - v_emp.quantidade_perdida;
  if p_quantidade > v_pend then
    raise exception 'Quantidade maior que a pendente (%).', v_pend;
  end if;

  perform public._saldo_somar(v_emp.item_id, p_endereco_destino_id, p_quantidade);

  v_dev := v_emp.quantidade_devolvida + p_quantidade;
  v_status := case
    when v_emp.quantidade - v_dev - v_emp.quantidade_perdida > 0 then 'devolvido_parcial'
    else 'devolvido'
  end;

  update public.emprestimos
     set quantidade_devolvida = v_dev,
         status = v_status,
         atualizado_em = now()
   where id = v_emp.id;

  insert into public.movimentacoes
    (tipo, item_id, quantidade, endereco_destino_id, usuario_id, motivo,
     emprestimo_id, chave_idempotencia)
  values
    ('devolucao', v_emp.item_id, p_quantidade, p_endereco_destino_id, v_uid, p_motivo,
     v_emp.id, p_chave_idempotencia)
  returning id into v_id;

  return jsonb_build_object('movimentacao_id', v_id, 'emprestimo_id', v_emp.id,
                            'status', v_status, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- RPC: MARCAR COMO PERDIDO (baixa o que não voltou; não mexe em saldo)
-- Obs.: sem chave de idempotência, só use online.
-- ---------------------------------------------------------------------
create function public.marcar_emprestimo_perdido(
  p_emprestimo_id uuid, p_quantidade numeric default null, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_emp    public.emprestimos;
  v_pend   numeric;
  v_qtd    numeric;
  v_perd   numeric;
  v_status public.status_emprestimo;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'O motivo é obrigatório.';
  end if;

  select * into v_emp from public.emprestimos where id = p_emprestimo_id for update;
  if v_emp.id is null then
    raise exception 'Empréstimo não encontrado.';
  end if;
  if v_emp.status in ('devolvido', 'perdido') then
    raise exception 'Este empréstimo já está encerrado.';
  end if;

  v_pend := v_emp.quantidade - v_emp.quantidade_devolvida - v_emp.quantidade_perdida;
  v_qtd  := coalesce(p_quantidade, v_pend);
  if v_qtd <= 0 or v_qtd > v_pend then
    raise exception 'Quantidade inválida: pendente = %.', v_pend;
  end if;
  perform public._carregar_item(v_emp.item_id, v_qtd, false);

  v_perd := v_emp.quantidade_perdida + v_qtd;
  v_status := case
    when v_emp.quantidade - v_emp.quantidade_devolvida - v_perd > 0 then
      case when v_emp.quantidade_devolvida > 0 then 'devolvido_parcial' else 'em_aberto' end
    when v_perd >= v_emp.quantidade then 'perdido'
    else 'devolvido'
  end;

  update public.emprestimos
     set quantidade_perdida = v_perd,
         status = v_status,
         baixado_por = v_uid,
         observacao = coalesce(observacao || E'\n', '') || 'Perdido (' || v_qtd || '): ' || p_motivo,
         atualizado_em = now()
   where id = v_emp.id;

  return jsonb_build_object('emprestimo_id', v_emp.id, 'status', v_status);
end $$;

-- ---------------------------------------------------------------------
-- VIEWS: empréstimos em aberto e atrasados (respeitam a RLS de quem consulta)
-- ---------------------------------------------------------------------
create view public.vw_emprestimos_abertos
with (security_invoker = true) as
select
  e.id,
  e.item_id,
  i.codigo as item_codigo,
  i.nome   as item_nome,
  e.emprestado_para,
  p.nome   as emprestado_para_nome,
  e.quantidade,
  e.quantidade_devolvida,
  e.quantidade_perdida,
  (e.quantidade - e.quantidade_devolvida - e.quantidade_perdida) as quantidade_pendente,
  e.emprestado_em,
  e.prazo_previsto,
  e.status,
  case when e.prazo_previsto is not null and e.prazo_previsto < public.hoje_br()
       then 'atrasado' else 'em_dia' end as situacao,
  case when e.prazo_previsto is not null and e.prazo_previsto < public.hoje_br()
       then public.hoje_br() - e.prazo_previsto else 0 end as dias_atraso
from public.emprestimos e
join public.itens  i on i.id = e.item_id
join public.perfis p on p.id = e.emprestado_para
where e.status in ('em_aberto', 'devolvido_parcial');

create view public.vw_emprestimos_atrasados
with (security_invoker = true) as
select * from public.vw_emprestimos_abertos where situacao = 'atrasado';

-- ---------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------
alter table public.movimentacoes enable row level security;
alter table public.emprestimos   enable row level security;

revoke all on public.movimentacoes, public.emprestimos,
  public.vw_emprestimos_abertos, public.vw_emprestimos_atrasados from anon;

-- Ninguém escreve direto: só as funções RPC
revoke insert, update, delete on public.movimentacoes, public.emprestimos from authenticated;
grant select on public.vw_emprestimos_abertos, public.vw_emprestimos_atrasados to authenticated;

-- Ledger: só professor/admin consultam
create policy movimentacoes_ver on public.movimentacoes for select to authenticated
  using ((select public.e_professor_ou_admin()));

-- Empréstimos: professor/admin veem todos; aluno vê os próprios
create policy emprestimos_ver on public.emprestimos for select to authenticated
  using (
    (select public.e_professor_ou_admin())
    or (emprestado_para = (select auth.uid()) and (select public.e_aprovado()))
  );

-- Funções: só usuários logados chamam as RPCs; as internas ficam fechadas
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
revoke execute on function
  public._buscar_idempotente(uuid, public.tipo_movimentacao, uuid),
  public._carregar_item(uuid, numeric, boolean, boolean),
  public._validar_endereco(uuid, boolean),
  public._saldo_somar(uuid, uuid, numeric),
  public._saldo_subtrair(uuid, uuid, numeric)
from authenticated;
