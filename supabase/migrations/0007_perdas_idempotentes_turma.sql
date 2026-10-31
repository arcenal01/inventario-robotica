-- =====================================================================
-- 0007_perdas_idempotentes_turma.sql: pendências da v0.8.1 (confirmadas pelo usuário)
-- 1) marcar_emprestimo_perdido ganha chave_idempotencia (reenvio não registra a perda 2 vezes)
--    e cada perda vira uma linha em emprestimo_perdas (histórico de quem, quanto, quando e por quê)
-- 2) Cadastro grava a turma (opcional) que vem nos metadados do Auth
-- Não altera as migrations anteriores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PERDAS DE EMPRÉSTIMO
-- ---------------------------------------------------------------------
create table public.emprestimo_perdas (
  id                 uuid primary key default gen_random_uuid(),
  emprestimo_id      uuid not null references public.emprestimos(id) on delete restrict,
  quantidade         numeric(12,3) not null check (quantidade > 0),
  motivo             text not null,
  registrado_por     uuid not null references public.perfis(id) on delete restrict,
  chave_idempotencia uuid not null unique,
  criado_em          timestamptz not null default now()
);
create index emprestimo_perdas_emprestimo_idx on public.emprestimo_perdas (emprestimo_id);

alter table public.emprestimo_perdas enable row level security;
revoke all on public.emprestimo_perdas from anon;
revoke insert, update, delete on public.emprestimo_perdas from authenticated;

-- Mesma regra dos empréstimos: professor/admin veem todas; aluno vê as dos próprios empréstimos
create policy emprestimo_perdas_ver on public.emprestimo_perdas for select to authenticated
  using (
    (select public.e_professor_ou_admin())
    or exists (
      select 1 from public.emprestimos e
      where e.id = emprestimo_id
        and e.emprestado_para = (select auth.uid())
        and (select public.e_aprovado())
    )
  );

-- Histórico imutável (igual ao ledger)
create function public.bloquear_alteracao_perda()
returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'O registro de perda não pode ser alterado nem apagado.';
end $$;

create trigger emprestimo_perdas_imutavel
  before update or delete on public.emprestimo_perdas
  for each row execute function public.bloquear_alteracao_perda();

create trigger auditoria_emprestimo_perdas after insert or update or delete on public.emprestimo_perdas
  for each row execute function public.registrar_auditoria();

-- Assinatura nova: a chave passa a ser obrigatória (a antiga, sem chave, é removida)
drop function public.marcar_emprestimo_perdido(uuid, numeric, text);

create function public.marcar_emprestimo_perdido(
  p_emprestimo_id uuid, p_quantidade numeric, p_motivo text, p_chave_idempotencia uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_dup    public.emprestimo_perdas;
  v_emp    public.emprestimos;
  v_pend   numeric;
  v_qtd    numeric;
  v_perd   numeric;
  v_status public.status_emprestimo;
  v_id     uuid;
begin
  if v_uid is null or not public.e_professor_ou_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_chave_idempotencia is null then
    raise exception 'A chave de idempotência é obrigatória.';
  end if;

  -- Reenvio da mesma chave: devolve o resultado da primeira vez, sem registrar de novo
  perform pg_advisory_xact_lock(hashtextextended(p_chave_idempotencia::text, 0));
  select * into v_dup from public.emprestimo_perdas where chave_idempotencia = p_chave_idempotencia;
  if v_dup.id is not null then
    if v_dup.emprestimo_id <> p_emprestimo_id then
      raise exception 'Esta chave de idempotência já foi usada em outra operação.';
    end if;
    select status into v_status from public.emprestimos where id = v_dup.emprestimo_id;
    return jsonb_build_object('emprestimo_id', v_dup.emprestimo_id, 'perda_id', v_dup.id,
                              'status', v_status, 'duplicada', true);
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

  insert into public.emprestimo_perdas (emprestimo_id, quantidade, motivo, registrado_por, chave_idempotencia)
  values (v_emp.id, v_qtd, btrim(p_motivo), v_uid, p_chave_idempotencia)
  returning id into v_id;

  update public.emprestimos
     set quantidade_perdida = v_perd,
         status = v_status,
         baixado_por = v_uid,
         observacao = coalesce(observacao || E'\n', '') || 'Perdido (' || v_qtd || '): ' || btrim(p_motivo),
         atualizado_em = now()
   where id = v_emp.id;

  return jsonb_build_object('emprestimo_id', v_emp.id, 'perda_id', v_id,
                            'status', v_status, 'duplicada', false);
end $$;

revoke execute on function public.marcar_emprestimo_perdido(uuid, numeric, text, uuid) from public, anon;
grant  execute on function public.marcar_emprestimo_perdido(uuid, numeric, text, uuid) to authenticated;
revoke execute on function public.bloquear_alteracao_perda() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) TURMA NO CADASTRO (opcional; vazio vira nulo; até 30 caracteres)
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, email, turma)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    left(nullif(btrim(new.raw_user_meta_data ->> 'turma'), ''), 30)
  );
  return new;
end $$;
