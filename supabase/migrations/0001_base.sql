-- =====================================================================
-- 0001_base.sql: Bloco 2
-- (v0.3.0: código de item passou a ter 4 dígitos: SEN-0001)
-- =====================================================================

-- Busca por nome (ilike rápido)
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- ENUMS (os demais entram nos blocos 3, 4 e 5)
-- ---------------------------------------------------------------------
create type public.perfil_usuario  as enum ('admin', 'professor', 'aluno');
create type public.status_cadastro as enum ('pendente', 'aprovado', 'rejeitado', 'bloqueado');
create type public.unidade_medida  as enum ('un', 'm', 'kg');
create type public.tipo_controle   as enum ('consumivel', 'emprestavel');
create type public.status_item     as enum ('ativo', 'inativo');

-- ---------------------------------------------------------------------
-- PERFIS (ligado ao Supabase Auth)
-- ---------------------------------------------------------------------
create table public.perfis (
  id              uuid primary key references auth.users(id) on delete cascade,
  nome            text not null,
  email           text not null unique,
  perfil          public.perfil_usuario  not null default 'aluno',
  status_cadastro public.status_cadastro not null default 'pendente',
  turma           text,
  aprovado_por    uuid references public.perfis(id),
  aprovado_em     timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- Funções de permissão (security definer evita recursão nas políticas RLS)
create function public.perfil_atual()
returns public.perfil_usuario
language sql stable security definer set search_path = '' as $$
  select p.perfil from public.perfis p
  where p.id = auth.uid() and p.status_cadastro = 'aprovado'
$$;

create function public.e_aprovado()
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.perfil_atual() is not null
$$;

create function public.e_professor_ou_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.perfil_atual() in ('admin', 'professor'), false)
$$;

create function public.e_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.perfil_atual() = 'admin', false)
$$;

revoke execute on function public.perfil_atual(), public.e_aprovado(),
  public.e_professor_ou_admin(), public.e_admin() from public, anon;
grant execute on function public.perfil_atual(), public.e_aprovado(),
  public.e_professor_ou_admin(), public.e_admin() to authenticated;

-- Proteção: ninguém se promove nem se aprova sozinho
-- (auth.uid() é nulo no SQL Editor/CLI, então o primeiro admin pode ser criado à mão)
create function public.proteger_perfil()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.e_admin() then
    if new.id <> old.id
       or new.email <> old.email
       or new.perfil <> old.perfil
       or new.aprovado_por is distinct from old.aprovado_por
       or new.aprovado_em  is distinct from old.aprovado_em then
      raise exception 'Sem permissão para alterar estes campos.';
    end if;

    if new.status_cadastro <> old.status_cadastro
       and not (public.e_professor_ou_admin() and old.perfil = 'aluno' and old.id <> auth.uid()) then
      raise exception 'Sem permissão para alterar o status do cadastro.';
    end if;

    if old.id <> auth.uid()
       and (new.nome <> old.nome or new.turma is distinct from old.turma) then
      raise exception 'Professor só pode aprovar ou rejeitar alunos.';
    end if;
  end if;

  if new.status_cadastro = 'aprovado' and old.status_cadastro <> 'aprovado' then
    new.aprovado_por := auth.uid();
    new.aprovado_em  := now();
  end if;

  new.atualizado_em := now();
  return new;
end $$;

create trigger perfis_protecao
  before update on public.perfis
  for each row execute function public.proteger_perfil();

-- Todo usuário novo do Auth ganha um perfil (aluno, pendente). Nunca confia no cliente.
create function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end $$;

create trigger ao_criar_usuario_auth
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------
-- CATEGORIAS (prefixo editável)
-- ---------------------------------------------------------------------
create table public.categorias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  prefixo   text not null unique check (prefixo ~ '^[A-Z]{2,5}$'),
  ativa     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TIPOS DE ENDEREÇO (o admin cria e edita: Armário, Estante, Gaveta, Caixa, Posição...)
-- ---------------------------------------------------------------------
create table public.tipos_endereco (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  prefixo        text not null unique check (prefixo ~ '^[A-Z]{1,5}$'),
  nivel          int  not null check (nivel >= 1),
  armazena_itens boolean not null default false,  -- true = posição (guarda saldo)
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- Não deixa mudar prefixo/nível/armazena_itens de um tipo que já está em uso
create function public.proteger_tipo_endereco()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.prefixo <> old.prefixo or new.nivel <> old.nivel or new.armazena_itens <> old.armazena_itens)
     and exists (select 1 from public.enderecos e where e.tipo_endereco_id = old.id) then
    raise exception 'Este tipo já está em uso: não é possível mudar prefixo, nível ou "armazena itens". Crie outro tipo.';
  end if;
  return new;
end $$;

create trigger tipos_endereco_protecao
  before update on public.tipos_endereco
  for each row execute function public.proteger_tipo_endereco();

-- ---------------------------------------------------------------------
-- ENDEREÇOS (árvore): ex.: ARM01-GAV03-CX02-P05
-- ---------------------------------------------------------------------
create table public.enderecos (
  id                 uuid primary key default gen_random_uuid(),
  tipo_endereco_id   uuid not null references public.tipos_endereco(id) on delete restrict,
  pai_id             uuid references public.enderecos(id) on delete restrict,
  numero             int  not null default 0,        -- gerado pelo banco
  codigo             text not null unique default '', -- gerado pelo banco, definitivo
  nome               text,
  descricao          text,
  ativo              boolean not null default true,
  substituido_por_id uuid references public.enderecos(id),  -- troca de QR
  criado_em          timestamptz not null default now()
);

create unique index enderecos_numero_unico
  on public.enderecos (
    coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tipo_endereco_id,
    numero
  );
create index enderecos_pai_idx on public.enderecos (pai_id);

create function public.gerar_codigo_endereco()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo       public.tipos_endereco;
  v_tipo_pai   public.tipos_endereco;
  v_codigo_pai text;
  v_numero     int;
  v_txt        text;
begin
  if tg_op = 'UPDATE' then
    if new.pai_id is distinct from old.pai_id or new.tipo_endereco_id <> old.tipo_endereco_id then
      raise exception 'Não é possível mover ou trocar o tipo de um endereço. Crie um novo endereço (troca de QR).';
    end if;
    new.numero := old.numero;
    new.codigo := old.codigo;
    return new;
  end if;

  select * into v_tipo from public.tipos_endereco where id = new.tipo_endereco_id;
  if not v_tipo.ativo then
    raise exception 'Tipo de endereço inativo.';
  end if;

  if new.pai_id is null then
    if v_tipo.nivel <> 1 then
      raise exception 'Endereço sem pai deve ser de um tipo de nível 1.';
    end if;
  else
    select e.codigo into v_codigo_pai from public.enderecos e where e.id = new.pai_id;
    select t.* into v_tipo_pai
      from public.tipos_endereco t
      join public.enderecos e on e.tipo_endereco_id = t.id
     where e.id = new.pai_id;

    if v_tipo_pai.armazena_itens then
      raise exception 'Uma posição não pode ter endereços dentro dela.';
    end if;
    if v_tipo.nivel <= v_tipo_pai.nivel then
      raise exception 'O nível do endereço deve ser maior que o do pai.';
    end if;
  end if;

  -- trava para dois cadastros simultâneos não pegarem o mesmo número
  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(new.pai_id::text, 'raiz') || new.tipo_endereco_id::text, 0)
  );

  select coalesce(max(e.numero), 0) + 1 into v_numero
    from public.enderecos e
   where e.pai_id is not distinct from new.pai_id
     and e.tipo_endereco_id = new.tipo_endereco_id;

  v_txt := v_numero::text;
  if length(v_txt) < 2 then v_txt := '0' || v_txt; end if;

  new.numero := v_numero;
  new.codigo := case when v_codigo_pai is null then '' else v_codigo_pai || '-' end
                || v_tipo.prefixo || v_txt;
  return new;
end $$;

create trigger enderecos_codigo
  before insert or update on public.enderecos
  for each row execute function public.gerar_codigo_endereco();

-- ---------------------------------------------------------------------
-- ITENS
-- ---------------------------------------------------------------------
create sequence public.itens_codigo_seq;

create table public.itens (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique default '',   -- gerado pelo banco (SEN-0001)
  nome           text not null,
  categoria_id   uuid not null references public.categorias(id) on delete restrict,
  unidade        public.unidade_medida not null default 'un',
  descricao      text,
  foto_url       text,
  especificacoes jsonb not null default '{}'::jsonb,
  estoque_minimo numeric(12,3) not null default 0 check (estoque_minimo >= 0),
  tipo_controle  public.tipo_controle not null default 'consumivel',
  status         public.status_item not null default 'ativo',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index itens_nome_trgm_idx  on public.itens using gin (nome extensions.gin_trgm_ops);
create index itens_categoria_idx  on public.itens (categoria_id);
create index itens_status_idx     on public.itens (status);

create function public.gerar_codigo_item()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefixo text;
  v_seq     text;
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;            -- código definitivo nunca muda
    new.atualizado_em := now();
    return new;
  end if;

  select c.prefixo into v_prefixo from public.categorias c where c.id = new.categoria_id;
  v_seq := nextval('public.itens_codigo_seq')::text;
  if length(v_seq) < 4 then v_seq := lpad(v_seq, 4, '0'); end if;

  new.codigo := v_prefixo || '-' || v_seq;
  return new;
end $$;

create trigger itens_codigo
  before insert or update on public.itens
  for each row execute function public.gerar_codigo_item();

-- ---------------------------------------------------------------------
-- SALDOS POR ENDEREÇO (só as funções RPC do Bloco 3 escrevem aqui)
-- ---------------------------------------------------------------------
create table public.saldos_por_endereco (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.itens(id) on delete restrict,
  endereco_id      uuid not null references public.enderecos(id) on delete restrict,
  quantidade_atual numeric(12,3) not null default 0 check (quantidade_atual >= 0),
  atualizado_em    timestamptz not null default now(),
  unique (item_id, endereco_id)
);

create index saldos_endereco_idx on public.saldos_por_endereco (endereco_id);

create function public.validar_saldo_endereco()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
      from public.enderecos e
      join public.tipos_endereco t on t.id = e.tipo_endereco_id
     where e.id = new.endereco_id and t.armazena_itens
  ) then
    raise exception 'Itens só podem ficar em endereços do tipo posição.';
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger saldos_validar
  before insert or update of endereco_id, quantidade_atual on public.saldos_por_endereco
  for each row execute function public.validar_saldo_endereco();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.perfis              enable row level security;
alter table public.categorias          enable row level security;
alter table public.tipos_endereco      enable row level security;
alter table public.enderecos           enable row level security;
alter table public.itens               enable row level security;
alter table public.saldos_por_endereco enable row level security;

revoke all on public.perfis, public.categorias, public.tipos_endereco,
  public.enderecos, public.itens, public.saldos_por_endereco from anon;

-- Saldo: ninguém escreve direto (só funções security definer)
revoke insert, update, delete on public.saldos_por_endereco from authenticated;

-- perfis: vê o próprio; professor/admin veem todos; ninguém insere/apaga pela API
create policy perfis_ver on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.e_professor_ou_admin()));
create policy perfis_alterar on public.perfis for update to authenticated
  using      (id = (select auth.uid()) or (select public.e_professor_ou_admin()))
  with check (id = (select auth.uid()) or (select public.e_professor_ou_admin()));

-- categorias: aprovados veem; professor/admin criam e editam; admin apaga
create policy categorias_ver on public.categorias for select to authenticated
  using ((select public.e_aprovado()));
create policy categorias_inserir on public.categorias for insert to authenticated
  with check ((select public.e_professor_ou_admin()));
create policy categorias_alterar on public.categorias for update to authenticated
  using ((select public.e_professor_ou_admin()))
  with check ((select public.e_professor_ou_admin()));
create policy categorias_excluir on public.categorias for delete to authenticated
  using ((select public.e_admin()));

-- tipos_endereco: aprovados veem; só admin escreve
create policy tipos_endereco_ver on public.tipos_endereco for select to authenticated
  using ((select public.e_aprovado()));
create policy tipos_endereco_admin on public.tipos_endereco for all to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

-- enderecos: aprovados veem; professor/admin criam e editam; admin apaga
create policy enderecos_ver on public.enderecos for select to authenticated
  using ((select public.e_aprovado()));
create policy enderecos_inserir on public.enderecos for insert to authenticated
  with check ((select public.e_professor_ou_admin()));
create policy enderecos_alterar on public.enderecos for update to authenticated
  using ((select public.e_professor_ou_admin()))
  with check ((select public.e_professor_ou_admin()));
create policy enderecos_excluir on public.enderecos for delete to authenticated
  using ((select public.e_admin()));

-- itens: aprovados veem; professor/admin criam e editam; admin apaga
create policy itens_ver on public.itens for select to authenticated
  using ((select public.e_aprovado()));
create policy itens_inserir on public.itens for insert to authenticated
  with check ((select public.e_professor_ou_admin()));
create policy itens_alterar on public.itens for update to authenticated
  using ((select public.e_professor_ou_admin()))
  with check ((select public.e_professor_ou_admin()));
create policy itens_excluir on public.itens for delete to authenticated
  using ((select public.e_admin()));

-- saldos: aprovados só leem
create policy saldos_ver on public.saldos_por_endereco for select to authenticated
  using ((select public.e_aprovado()));
