-- Teste do Bloco 7: o que as telas de login/cadastro/usuários exigem do banco.
-- Simula o papel "authenticated" (como a API do Supabase faz). Termina em ROLLBACK.
begin;

do $$
declare
  adm uuid := gen_random_uuid();
  prof uuid := gen_random_uuid();
  alu uuid := gen_random_uuid();
  alu2 uuid := gen_random_uuid();
  novo uuid := gen_random_uuid();
  v_nome text; v_perfil text; v_status text; v_n int; v_por uuid;
begin
  -- 1) Cadastro: o trigger cria o perfil (aluno, pendente) com o nome dos metadados
  insert into auth.users (id, email, raw_user_meta_data) values
    (adm,  'tb7-admin@escola.local', '{"nome":"Admin TB7"}'),
    (prof, 'tb7-prof@escola.local',  '{"nome":"Professor TB7"}'),
    (alu,  'tb7-aluno@escola.local', '{"nome":"Aluno TB7"}'),
    (alu2, 'tb7-aluno2@escola.local', '{"nome":"Aluno Dois TB7"}'),
    (novo, 'tb7-novo@escola.local',  '{"nome":"  Novo Cadastro  "}');
  select nome, perfil::text, status_cadastro::text into v_nome, v_perfil, v_status from public.perfis where id = novo;
  raise notice '1) perfil criado: nome=[%] perfil=% status=% (esperado [Novo Cadastro] aluno pendente)', v_nome, v_perfil, v_status;

  -- Prepara (como postgres, sem usuário logado): admin, professor e alunos aprovados
  update public.perfis set perfil = 'admin',     status_cadastro = 'aprovado' where id = adm;
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = prof;
  update public.perfis set status_cadastro = 'aprovado' where id in (alu, alu2);

  -- 2) Usuário pendente enxerga só o próprio perfil
  perform set_config('request.jwt.claims', json_build_object('sub', novo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.perfis;
  raise notice '2) pendente enxerga % perfil(is) (esperado 1)', v_n;
  begin
    update public.perfis set status_cadastro = 'aprovado' where id = novo;
    raise notice '2b) FALHOU: pendente conseguiu se aprovar';
  exception when others then
    raise notice '2b) OK, pendente não se aprova sozinho: %', sqlerrm;
  end;
  reset role;

  -- 3) Aluno aprovado não vê os outros e não altera ninguém
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.perfis;
  raise notice '3) aluno enxerga % perfil(is) (esperado 1)', v_n;
  update public.perfis set status_cadastro = 'aprovado' where id = novo;
  get diagnostics v_n = row_count;
  raise notice '3b) aluno aprovando outro: linhas alteradas=% (esperado 0, bloqueado pelo RLS)', v_n;
  reset role;

  -- 4) Professor vê todos e aprova um aluno pendente
  perform set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.perfis where id in (adm, prof, alu, alu2, novo);
  raise notice '4) professor enxerga % dos 5 perfis de teste (esperado 5)', v_n;
  update public.perfis set status_cadastro = 'aprovado' where id = novo;
  get diagnostics v_n = row_count;
  select status_cadastro::text, aprovado_por into v_status, v_por from public.perfis where id = novo;
  raise notice '4b) professor aprovou: linhas=% status=% aprovado_por_é_o_professor=% (esperado 1, aprovado, true)', v_n, v_status, (v_por = prof);

  -- 5) Professor NÃO promove, nem mexe em professor/admin
  begin
    update public.perfis set perfil = 'professor' where id = alu;
    raise notice '5) FALHOU: professor promoveu aluno';
  exception when others then
    raise notice '5) OK, professor não promove: %', sqlerrm;
  end;
  begin
    update public.perfis set status_cadastro = 'bloqueado' where id = adm;
    raise notice '5b) FALHOU: professor bloqueou admin';
  exception when others then
    raise notice '5b) OK, professor não bloqueia admin: %', sqlerrm;
  end;
  -- 5c) Professor bloqueia e reativa aluno
  update public.perfis set status_cadastro = 'bloqueado' where id = alu2;
  update public.perfis set status_cadastro = 'aprovado'  where id = alu2;
  raise notice '5c) professor bloqueou e reativou aluno sem erro';
  reset role;

  -- 6) Admin define a função (professor aprovado pelo admin) e bloqueia
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.perfis set perfil = 'professor', status_cadastro = 'aprovado' where id = alu;
  select perfil::text into v_perfil from public.perfis where id = alu;
  raise notice '6) admin promoveu aluno: perfil=% (esperado professor)', v_perfil;
  update public.perfis set status_cadastro = 'bloqueado' where id = alu;
  select status_cadastro::text into v_status from public.perfis where id = alu;
  raise notice '6b) admin bloqueou: status=% (esperado bloqueado)', v_status;
  reset role;

  -- 7) Usuário bloqueado perde o acesso aos dados (perfil_atual() vira nulo)
  perform set_config('request.jwt.claims', json_build_object('sub', alu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.itens;
  raise notice '7) bloqueado enxerga % itens (esperado 0)', v_n;
  reset role;
end $$;

rollback;
