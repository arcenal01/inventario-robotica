# PROGRESSO: Inventário Robótica

Versão atual: v0.9.0 (padrão: v0.<bloco>.0; correções e sub-blocos = v0.<bloco>.1, .2...; v1.0.0 só na `main` ao final)
Entrega: GitHub (https://github.com/arcenal01/inventario-robotica); o .zip com nome e versão continua opcional

## Blocos concluídos (Fase 1: banco COMPLETA; Fase 2: ambiente COMPLETA; Fase 3 em andamento)
- Bloco 1: modelo de dados (docs/01-modelo-de-dados.md)
- Bloco 2: migration base (0001_base.sql) + testes (bloco2_testes.sql)
- Bloco 3: movimentações e empréstimos (0002_movimentacoes_emprestimos.sql) + testes (bloco3_testes.sql)
- Bloco 4: pedidos e romaneios (0003_pedidos_romaneios.sql) + testes (bloco4_testes.sql)
- Bloco 5: contagens e auditoria (0004_contagens_auditoria.sql) + seed (supabase/seed.sql) + testes (bloco5_testes.sql)
- Bloco 6: ambiente local e GitHub (docs/06-ambiente-local.md, package.json, scripts/rodar-testes.mjs, .env.example, .gitignore, .github/workflows/ci.yml e banco.yml, README.md)
- Bloco 7: base do Next.js (docs/07-base-nextjs.md, src/, tests/schemas.test.mjs, supabase/testes/bloco7_testes.sql)
- Bloco 8A: endereços e troca de QR (0005_trocas_qr.sql, bloco8a_testes.sql, src/features/enderecos, docs/08a-enderecos.md, tests/arvore.test.mjs)
- Bloco 9 (v0.9.0): movimentações e empréstimos (src/features/estoque, src/features/emprestimos, rotas /movimentacoes, /emprestimos e /menu, src/lib/chave.ts, datas.ts, erros.ts, docs/09-movimentacoes-emprestimos.md, tests/emprestimos.test.mjs); sem migration nova
- Bloco 8B (v0.8.2): itens e categorias (0008_itens_fotos_estoque.sql, bloco8b_testes.sql, src/features/itens, rotas /itens e /itens/categorias, docs/08b-itens.md, tests/itens.test.mjs)
- v0.8.1 (validação do Bloco 6 no PC do usuário, CONCLUÍDA): repositório público https://github.com/arcenal01/inventario-robotica com main e homologacao; PR #1 (só para testar o CI) passou nos 2 workflows e foi fechado sem merge; Git 2.56, WSL2 e Docker Desktop 4.97 instalados; `supabase init` (config.toml); db:start aplicou 0001-0006 + seed; db:testes 7/7 arquivos OK; db:tipos gerou o database.ts oficial; .env.local criado; npm install, lint, typecheck, test e build OK; @supabase/ssr 0.6.1 -> 0.12.7; package-lock.json gerado; migration 0006 (código de item com 3 dígitos por prefixo) + bloco6_codigo_item_testes.sql; migration 0007 (perda idempotente em emprestimo_perdas + turma no cadastro) + bloco6b_perdas_turma_testes.sql; campo Turma no cadastro e na tela /usuarios; branches protegidas

## Decisões tomadas
- Primeiro admin criado manualmente por SQL; professor aprovado pelo admin
- Professor só aprova/rejeita alunos; só admin muda perfil (trigger proteger_perfil)
- Prefixos de categoria editáveis; unidades em lista fixa (un, m, kg); "un" só aceita quantidade inteira
- Código de item (v0.8.1, confirmado pelo usuário): prefixo da categoria + contador POR PREFIXO de 3 dígitos (SEN-001, SEN-002, MOT-001); passa de 999 sem cortar (SEN-1000); definitivo. Migration nova 0006 (não altera a 0001); contador em contadores_codigo com ano = 0, ligado ao prefixo (não à categoria) para nunca repetir código se um prefixo for trocado e reaproveitado
- Códigos de PED/ROM/CNT continuam com 4 dígitos (PED-2026-0001)
- Perda de empréstimo (v0.8.1, confirmado pelo usuário): marcar_emprestimo_perdido(emprestimo, quantidade, motivo, chave) com chave_idempotencia OBRIGATÓRIA; cada perda vira linha imutável em emprestimo_perdas (aluno vê as dos próprios empréstimos); reenvio da mesma chave devolve duplicada = true; quantidade nula = todo o pendente
- Turma no cadastro (v0.8.1, confirmado pelo usuário): campo opcional (professores usam o mesmo cadastro), até 30 caracteres; vai nos metadados do Auth e o trigger criar_perfil_novo_usuario grava em perfis.turma; aparece e é pesquisável em /usuarios
- Tela de notificações (sino): fica no Bloco 10 (pedidos), confirmado pelo usuário

### Bloco 8B (itens)
- Migration 0008 (aditiva): bucket itens-fotos (público para leitura, envio/troca/remoção só professor/admin, 2 MB, jpeg/png/webp); view vw_itens_estoque (security_invoker); trigger proteger_item
- foto_url guarda o CAMINHO no bucket (<item_id>/<timestamp>.jpg), não a URL: vale local e na nuvem; o app monta a URL pública
- Foto reduzida no aparelho (máx. 1024 px, JPEG 0,82) antes do envio; input com capture="environment" abre a câmera no celular; trocar foto apaga a antiga; falha na foto não desfaz o cadastro
- Unidade e tipo de controle não mudam depois que o item tem movimentação ou saldo (banco); a tela trava os campos quando há saldo ou empréstimo
- Estoque mínimo inteiro em "un" (banco e tela); 0 = sem alerta; abaixo_minimo só para item ativo com mínimo > 0
- Categorias: professor e admin criam/editam/desativam (confirmado pelo usuário, mantém o RLS do Bloco 2); excluir só admin; trocar prefixo não muda códigos existentes
- Especificações: pares nome = valor em itens.especificacoes (jsonb), até 20, sem nome repetido
- Lista: carrega todos os itens e filtra no aparelho (busca sem acento em código/nome/descrição; filtros categoria, tipo, situação, abaixo do mínimo); abaixo do mínimo primeiro
- Item não é excluído pela tela: usar inativo
- Rotas: /itens (todos aprovados), /itens/categorias (professor/admin); menu ganhou "Itens"

### Bloco 9 (movimentações e empréstimos)
- Sem migration: as telas usam as RPCs do Bloco 3 (registrar_entrada, registrar_saida, transferir, ajustar, emprestar, devolver) e a marcar_emprestimo_perdido da 0007
- Uma chave_idempotencia por janela aberta, reaproveitada em toda tentativa (reenvio não duplica); src/lib/chave.ts gera UUID v4 também sem crypto.randomUUID (celular em http://IP)
- /movimentacoes só professor/admin (o ledger já era só deles pelo RLS); histórico: 200 mais recentes, filtros período/tipo/item
- /emprestimos para todos: professor/admin veem tudo e agem; aluno vê "Meus empréstimos" (RLS) sem botões
- Atraso calculado na tela com a data de Brasília (mesma regra da view do banco); atrasados primeiro
- Devolução sugere a posição de origem (se ainda ativa); perda não mexe no saldo
- Ficha do item ganhou atalho "Registrar entrada" (professor/admin)
- Menu: campo principal em src/lib/navegacao.ts; celular mostra os principais + "Mais" (/menu); topo mostra tudo com rolagem
- tsconfig: allowImportingTsExtensions (módulos puros importam .ts entre si para rodar no node --test)
- Toda entrada de estoque exige endereço; saldo só em posições (tipo com armazena_itens = true)
- Endereços em árvore; tipos_endereco só pelo admin; endereço não muda de pai/tipo (troca de QR = novo endereço + substituido_por_id)
- Tabelas de negócio sem escrita direta: só funções RPC (security definer)
- RPCs de estoque (professor/admin): registrar_entrada, registrar_saida, transferir, ajustar, emprestar, devolver, marcar_emprestimo_perdido; todas com chave_idempotencia
- Lock por item (pg_advisory_xact_lock) serializa movimentos do mesmo item
- registrar_saida só para consumível; emprestável sai por empréstimo; baixa por perda/quebra via ajuste ou marcar_emprestimo_perdido
- Empréstimo: prazo opcional; devolução parcial; "atrasado" calculado nas views (horário de Brasília); aluno vê só os próprios
- Ledger visível só para professor/admin; trigger bloqueia UPDATE/DELETE
- Códigos anuais (PED/ROM/CNT) via contadores_codigo + trigger gerar_codigo_anual; sem repetição
- Pedido: qualquer usuário aprovado cria (salvar_pedido, idempotente, rascunho editável); professor pode alterar quantidades na aprovação; pode misturar consumíveis e emprestáveis
- Romaneio: endereços com mais saldo primeiro; saldo NÃO é reservado, só baixa na entrega; um ativo por pedido; avulso permitido
- Entrega: conferência item a item (entrega só o conferido); consumível = saída, emprestável = empréstimo para quem recebe; transação única; idempotente
- Pedido só com consumíveis vai direto a "concluido" na entrega; com emprestáveis fica "entregue" até concluir_pedido
- Contagem: escopo geral, por_endereco (endereço + tudo dentro) ou por_categoria; aluno/professor/admin contam (registrar_contagem, uma posição por chamada, idempotente por chave)
- Contagem: um aluno por item/posição na rodada 1; recontagem (pedida pelo professor) só por OUTRA pessoa
- Contagem: itens com saldo que ficaram fora da lista de uma posição contada viram "não listado" (contado = 0) ao encerrar, para o professor revisar
- Contagem: empréstimos em aberto não geram divergência porque já saíram do saldo; o valor fica em emprestado_em_aberto só para consulta
- Aprovação da contagem: ajuste = saldo ATUAL + divergência (movimentos feitos depois da contagem não são desfeitos); gera movimentação de ajuste ligada à contagem
- Encerrar contagem com posições sem contagem exige p_forcar = true
- Auditoria: triggers em perfis, categorias, tipos_endereco, enderecos, itens, emprestimos, pedidos, romaneios, contagens; imutável; só admin consulta
- Seed (supabase/seed.sql): só dev/homologação; senha dos usuários de teste: Teste@12345 (admin@, prof@, aluno1@, aluno2@, aluno3@ pendente, todos @escola.local)

- Ambiente local: Supabase CLI via npm (devDependency, sem instalação global) + Docker Desktop; config.toml gerado por `npx supabase init` e commitado
- Scripts npm: db:start, db:stop, db:status, db:reset, db:testes (roda supabase/testes/*.sql no container; falha se houver erro de SQL ou linha "FALHOU")
- package.json fica na RAIZ (Next.js na raiz, junto de supabase/); lint = eslint, typecheck = tsc --noEmit, test = node --test (schemas), db:tipos gera src/types/database.ts
- Variáveis: .env.example no repositório; .env.local para dev; .env.homologacao e .env.producao fora do repositório (.gitignore ignora .env*, exceto o exemplo)
- GitHub: branches main e homologacao; primeiro envio direto em homologacao (exceção única, sem CI ainda); depois sempre feature/* > PR > homologacao > PR > main; tags vX.Y.Z na main
- Branches protegidas (v0.8.1): main e homologacao exigem PR e o check "Lint e tipos" (o check do banco não é obrigatório porque só roda quando o PR mexe em supabase/); sem aprovação mínima (dev solo); sem force push
- GitHub (v0.8.1): conta arcenal01, repositório PÚBLICO (escolha do usuário); commits como luizgg4502 <luizgg4502@gmail.com>; GitHub CLI (gh) instalado e logado no PC
- CI (ci.yml): lint + checagem de tipos em cada PR; banco.yml (opcional): sobe Supabase no GitHub, aplica migrations/seed e roda os testes SQL quando o PR mexe em supabase/
- Testes SQL usam prefixos próprios (TSB, TST, TSQ, TSC...) para não colidir com o seed
- Celular: para testar telas, apontar NEXT_PUBLIC_SUPABASE_URL para o IP do computador; PWA/HTTPS só no Bloco 14
- Migração para nuvem: só trocar variáveis + `supabase link` e `supabase db push`; nunca rodar o seed na nuvem

- Endereços (confirmado pelo usuário): tipos de armário/estante e níveis livres, criados e editados pelo admin (Armário/Estante > Prateleira/Gaveta > Caixa > Posição, ex.: ARM01-GAV03-CX02-P05); posição obrigatória; caixa pode conter itens/ferramentas; se a mudança alterar o QR (ex.: caixa muda de lugar), o sistema gera NOVO endereço/QR e abre requisição para admin/professor trocarem a etiqueta
- Contagem (confirmado pelo usuário): mesmo código em locais diferentes pode ser contado por pessoas diferentes; mesmo código no mesmo local = só um aluno na rodada 1 (já implementado); códigos diferentes em locais diferentes são possíveis, mas raros

### Bloco 7 (frontend base)
- Convenção de nomes: domínio em PORTUGUÊS (variáveis, funções, componentes, tipos, rotas, pastas de features); nomes exigidos por Next/React/bibliotecas em inglês; components/ui no padrão shadcn (inglês); arquivos em kebab-case (detalhes em docs/07-base-nextjs.md)
- Stack do app: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4 + React Hook Form + Zod 3 + TanStack Query 5 + @supabase/ssr; sem biblioteca de ícones por enquanto
- Estrutura: src/app (rotas), src/features/<módulo>, src/components, src/lib (supabase, auth, env, navegacao), src/types
- Sessão: middleware renova cookies e manda quem não logou para /entrar; layout (app) exige cadastro aprovado; cada página pode exigir papel (exigirPapel). O banco (RLS + trigger proteger_perfil) é a autoridade final
- Cadastro: só nome, e-mail e senha (mín. 8); todo cadastro vira aluno pendente por trigger; professor é aprovado pelo admin escolhendo a função na aprovação (ou mudando depois)
- Tela /usuarios: professor aprova/rejeita/bloqueia/reativa só ALUNOS; admin faz tudo (inclusive função), menos em si mesmo
- Logout por POST /sair (303); menu por perfil em src/lib/navegacao.ts (cada bloco de tela acrescenta um item)
- src/types/database.ts: versão inicial gerada das migrations 0001-0004; substituir pela saída oficial com `npm run db:tipos` (script grava em UTF-8, evita o problema do `>` no PowerShell)
- components/ui escritos à mão no padrão shadcn (components.json já configurado para `npx shadcn add`)
- `npm run dev` escuta em 0.0.0.0 (celular na mesma rede); DEV_ORIGINS no .env.local libera o IP no Next.js
- CI: lint, tipos, testes e build (variáveis falsas só para compilar)

### Bloco 8A (endereços)
- Migration 0005 (aditiva, não altera as anteriores): tabelas trocas_qr e trocas_qr_etiquetas, view vw_troca_qr_etiquetas, RPCs mover_endereco e concluir_troca_qr, trigger proteger_endereco
- Mover endereço = troca de QR: clona o endereço e tudo que está dentro sob o novo pai (códigos novos), transfere o estoque por `transferir` (ledger), desativa os antigos (substituido_por_id), abre requisição pendente e notifica professor/admin
- Bloqueios: contagem em andamento (aberta/em_andamento/em_revisao) ou romaneio aberto (gerado/em_separacao/separado) que inclua o endereço; mover para dentro de si mesmo ou para onde já está; organizar só vale para endereços que têm pai
- Proteções novas no banco: não cria dentro de endereço inativo; não desativa com estoque ou com filhos ativos; endereço substituído não reativa; substituido_por_id só muda pela função
- Tipos de endereço (nome, prefixo, nível, armazena_itens): só o admin cria/edita (RLS já existia); prefixo/nível/armazena_itens não mudam se o tipo está em uso (trigger do Bloco 2)
- QR guarda só o CÓDIGO do endereço (sem URL): etiqueta independe do endereço do site
- Rotas: /enderecos (árvore, busca, criar, editar, mover, desativar), /enderecos/tipos (admin), /enderecos/trocas (professor/admin), /enderecos/etiquetas (?ids= ?raiz= ?todos=1 ?troca=)
- Criação em lote (1 a 50 endereços iguais de uma vez)
- Aluno consulta endereços e imprime etiquetas; não edita
- Início mostra cartão de troca de QR pendente para professor/admin
- Biblioteca nova: qrcode.react

## Pendências
- Leitor de QR (Bloco 12) deve reconhecer etiqueta antiga (endereço substituído) e indicar o código novo
- Tela de notificações (sino): Bloco 10; as notificações de troca de QR e de pedidos já são gravadas em notificacoes
- Nuvem: se a confirmação de e-mail estiver ligada, o cadastro mostra "confirme seu e-mail" (já tratado na tela)
- Offline das telas de login/usuários: Blocos 14 e 15
- HTTPS no celular + proxy para o Supabase local: Bloco 14
- Romaneio: saldo não reservado; se o estoque mudar entre gerar e entregar, a entrega falha e nada é baixado

## Problemas conhecidos
- v0.8.1: Blocos 7 e 8A COMPILADOS no PC do usuário (Windows 11, Node 24.14, npm 11.9): npm install, lint, typecheck, testes unitários (33) e build OK (Next 15.5.28, React 19.3, supabase-js 2.118, @supabase/ssr 0.12.7). Problema achado e corrigido: @supabase/ssr 0.6.1 é incompatível com os tipos do supabase-js 2.118 (tudo virava `never` no typecheck)
- v0.8.1: banco REAL testado no PC (Supabase CLI 2.122, Postgres 17.11): migrations 0001-0008 e seed aplicados sem erro (db:reset); os 9 arquivos de teste SQL passaram (sem erro e sem "FALHOU"); login dos usuários do seed (admin@, prof@, aluno1@) funciona na API de Auth; scripts/rodar-testes.mjs e gerar-tipos.mjs funcionam no Windows
- v0.8.1: workflows ci.yml e banco.yml executados no GitHub (PR #1): os dois passaram
- Contagem não é "às cegas": alunos podem ler saldos (necessário para a consulta offline)
- O seed cria usuários direto em auth.users; se a versão local do Supabase mudar as colunas, ajustar o seed
