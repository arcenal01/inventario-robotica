# Base do Next.js (Bloco 7)

Login, cadastro com aprovação, controle de acesso por perfil e o esqueleto do app. Tudo em português do Brasil na tela.

## 1. Convenção de nomes (vale para todos os blocos)

| O quê | Idioma / padrão | Exemplos |
|---|---|---|
| Tabelas, colunas, enums, funções SQL | português, snake_case, sem acento | `perfis`, `status_cadastro`, `registrar_saida` |
| Variáveis, funções, tipos e componentes do **nosso** domínio | português | `exigirPapel`, `PainelUsuarios`, `criarClienteNavegador`, `Perfil` |
| Rotas (URLs) e pastas de `features/` | português, minúsculas | `/entrar`, `/usuarios`, `features/usuarios` |
| Arquivos | kebab-case | `painel-usuarios.tsx`, `formulario-entrar.tsx` |
| Nomes que o Next.js, React e bibliotecas exigem | inglês (não dá para mudar) | `page.tsx`, `layout.tsx`, `middleware.ts`, `useState` |
| `src/components/ui/*` (shadcn/ui) | inglês, como o shadcn gera | `Button`, `Card`, `Input` |

Regra prática: se o nome existe no banco ou na vida da escola (perfil, item, pedido), use português. Se é peça técnica do framework, use o nome do framework.

## 2. Pastas

```
src/
  app/                 rotas (cada pasta = uma URL)
    entrar/            login
    cadastro/          criar conta (nome, e-mail, turma opcional, senha)
    aguardando-aprovacao/   tela para quem ainda não foi aprovado
    sair/              POST: encerra a sessão
    (app)/             tudo aqui exige login + cadastro aprovado
      page.tsx           início
      usuarios/          aprovar cadastros (professor/admin)
  components/          peças compartilhadas (cabeçalho, menu, ui/)
  features/            um módulo por pasta: formulários, schemas Zod, painéis
    auth/  usuarios/
  lib/
    supabase/          client.ts (navegador), server.ts (servidor), sessao.ts (middleware)
    auth/perfil.ts     exigirAprovado() e exigirPapel([...])
    navegacao.ts       itens do menu por perfil
    env.ts             valida as variáveis do .env
  types/               database.ts (gerado do banco) e index.ts (atalhos)
  middleware.ts        renova a sessão e manda quem não logou para /entrar
```

## 3. Como o acesso funciona

1. **middleware.ts**: sem login, qualquer página vai para `/entrar`. Com login, `/entrar` e `/cadastro` voltam para `/`.
2. **(app)/layout.tsx**: exige cadastro **aprovado**. Pendente, rejeitado ou bloqueado vai para `/aguardando-aprovacao`.
3. **Cada página** pode exigir um papel: `exigirPapel(["admin", "professor"])`. Aluno que digitar `/usuarios` volta para o início.
4. **O banco é a autoridade final.** As regras acima só escondem telas; quem impede de verdade é o RLS e o trigger `proteger_perfil` (testados em `supabase/testes/bloco7_testes.sql`).

Quem se cadastra vira sempre **aluno pendente** (trigger no banco). Para um professor: ele se cadastra, o admin aprova escolhendo a função "Professor" (ou aprova e muda depois).
O primeiro admin continua sendo criado à mão (ver `docs/06-ambiente-local.md`, seção 7).

Validação com Zod: nos formulários (cliente), no envio das alterações de usuário (antes de gravar) e, no servidor, pelas regras do banco (constraints, RLS, triggers). Não há endpoints próprios nesta fase.

## 4. Rodar e testar

```
npm install
npm run db:start          # se o banco ainda não estiver ligado
```
Crie `.env.local` copiando `.env.example` e cole a chave pública (`npm run db:status`). Depois:
```
npm run dev
```
Abra http://localhost:3000.

Roteiro de teste (senha de todos: `Teste@12345`):

| # | Faça | Esperado |
|---|---|---|
| 1 | Abrir `/` sem login | vai para `/entrar` |
| 2 | Entrar com `aluno3@escola.local` (pendente) | tela "Cadastro enviado"; `/` e `/usuarios` voltam para ela |
| 3 | Entrar com `aluno1@escola.local` | início; menu só com "Início"; digitar `/usuarios` volta para `/` |
| 4 | Entrar com `prof@escola.local` | menu com "Usuários"; aprovar o aluno3 funciona; não aparece seletor de função |
| 5 | Entrar com `admin@escola.local` | em "Usuários" aparece o seletor de função; mudar um aluno para professor funciona |
| 6 | Criar conta em `/cadastro` | cai em "Cadastro enviado"; no admin, aparece em "Aguardando aprovação" |
| 7 | Senha errada no login | "E-mail ou senha incorretos." |
| 8 | Botão "Sair" | volta para `/entrar` e `/` pede login de novo |

Verificações automáticas:

| Comando | O que confere |
|---|---|
| `npm run typecheck` | tipos do TypeScript |
| `npm run lint` | estilo e erros comuns |
| `npm test` | schemas Zod (sem banco) |
| `npm run build` | se o app compila para produção |
| `npm run db:testes` | banco, inclusive o novo `bloco7_testes.sql` |

Mudou o banco? Rode `npm run db:tipos` para atualizar `src/types/database.ts`.

## 5. Testar pelo celular (mesma rede Wi-Fi)

1. Descubra o IP do computador (ex.: `192.168.0.20`).
2. No `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.20:54321` e `DEV_ORIGINS=192.168.0.20`.
3. Reinicie `npm run dev`, libere as portas 3000 e 54321 no firewall.
4. No celular, abra `http://192.168.0.20:3000`.

O PWA (instalar e funcionar offline) exige HTTPS e entra no Bloco 14.

## 6. shadcn/ui

Os componentes de `components/ui` foram escritos à mão no padrão do shadcn (mesmas classes e a função `cn`). O `components.json` já está configurado, então mais adiante dá para rodar `npx shadcn@latest add dialog` e o arquivo novo se encaixa.

## 7. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Variáveis de ambiente inválidas" ao abrir | falta o `.env.local` ou a chave ainda é o texto de exemplo |
| Login dá "Sem conexão com o servidor" | o banco está desligado (`npm run db:start`) ou a URL do `.env.local` está errada |
| Celular não abre a página | IP errado, firewall ou `DEV_ORIGINS` não definido |
| Erro de tipos depois de mudar o banco | `npm run db:tipos` |
| "Sem permissão" ao aprovar | o RLS/trigger bloqueou: confira o perfil de quem está logado |
