# Ambiente local, GitHub e CI (Bloco 6)

Guia para quem está começando. Faça na ordem. Se algo der erro, copie a mensagem inteira e envie.

## 1. Instale uma vez só

| Programa | Para quê | Onde baixar |
|---|---|---|
| **Docker Desktop** | roda o banco e o Supabase no seu computador | docker.com/products/docker-desktop |
| **Node.js 22 (LTS)** | roda os comandos `npm` | nodejs.org |
| **Git** | controla as versões do código | git-scm.com |
| VS Code (opcional) | editor de código | code.visualstudio.com |

Windows: o Docker Desktop pede o "WSL 2". Aceite quando ele oferecer instalar e reinicie o computador.
Recomendado: 8 GB de memória ou mais. A primeira subida baixa alguns GB de imagens (precisa de internet nesse momento).

Confira no terminal (PowerShell, Terminal do Mac ou Linux):
```
docker --version
node --version
git --version
```
O `node` deve mostrar `v22` ou maior. Abra o Docker Desktop e espere ele ficar "Running" antes de continuar.

## 2. Primeira vez: subir o banco

1. Descompacte o `.zip` numa pasta simples, por exemplo `C:\projetos\inventario-robotica` (evite pastas com acento ou espaço).
2. Abra o terminal **dentro dessa pasta**.
3. Instale as ferramentas:
   ```
   npm install
   ```
4. Crie a configuração do Supabase (só na primeira vez):
   ```
   npx supabase init
   ```
   Se perguntar sobre VS Code/IntelliJ, responda `n`. Isso cria `supabase/config.toml`. **Esse arquivo vai para o GitHub.**
5. Suba o banco (a primeira vez demora, é normal):
   ```
   npm run db:start
   ```
   Isso já aplica as 4 migrations e o seed.
6. Veja os endereços e chaves:
   ```
   npm run db:status
   ```
   Anote a **API URL** (`http://127.0.0.1:54321`), o **Studio URL** (`http://127.0.0.1:54323`) e a chave pública (aparece como `anon key` ou `Publishable key`).
7. Crie o arquivo de ambiente:
   - copie `.env.example` para `.env.local`
   - cole a chave pública em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Conferir se está tudo certo

1. Abra o **Studio** (`http://127.0.0.1:54323`) > **Table Editor**: devem aparecer as tabelas (`itens`, `enderecos`, `pedidos`...), e `itens` com 15 linhas.
2. Rode os testes automáticos:
   ```
   npm run db:testes
   ```
   Resultado esperado: cada arquivo termina com `sem erros e sem "FALHOU"`, e os valores "esperado" batem com os mostrados.
   Para testar só um bloco: `npm run db:testes -- bloco3`
3. Se aparecer erro de SQL, copie a saída inteira e me envie. As migrations e os testes já passaram num Postgres 16 de verificação, mas ainda não no Supabase local real, então um pequeno ajuste (principalmente no `seed.sql`) ainda é possível.

Usuários de teste (senha de todos: `Teste@12345`):

| E-mail | Perfil |
|---|---|
| admin@escola.local | admin |
| prof@escola.local | professor |
| aluno1@escola.local, aluno2@escola.local | aluno (aprovados) |
| aluno3@escola.local | aluno (pendente de aprovação) |

## 4. Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `npm run db:start` | liga o banco |
| `npm run db:stop` | desliga o banco (os dados ficam guardados) |
| `npm run db:status` | mostra endereços e chaves |
| `npm run db:reset` | **apaga tudo** e recria o banco do zero (migrations + seed) |
| `npm run db:testes` | roda os testes SQL |

Mudou uma migration que já tinha rodado? Use `npm run db:reset`. Para uma mudança nova depois do sistema em uso, crie uma migration nova (`0005_...sql`), nunca edite as antigas.

## 5. Git e GitHub

Branches: `main` (produção) e `homologacao` (testes). Tudo novo sai de `homologacao`.

### 5.1 Criar o repositório (uma vez)
1. No GitHub, crie um repositório **vazio** e privado, chamado `inventario-robotica` (sem README).
2. No terminal, dentro da pasta do projeto:
   ```
   git init
   git checkout -b main
   git add README.md .gitignore
   git commit -m "chore: commit inicial"
   git remote add origin https://github.com/SEU-USUARIO/inventario-robotica.git
   git push -u origin main
   ```
3. Crie a `homologacao` e envie o projeto inteiro (única exceção: o primeiro envio vai direto, porque ainda não existe CI):
   ```
   git checkout -b homologacao
   git add .
   git status
   git commit -m "feat: banco de dados completo e ambiente local (blocos 1 a 6)"
   git push -u origin homologacao
   ```
   Antes do `commit`, olhe o `git status`: **não pode aparecer nenhum arquivo `.env`** (só o `.env.example`).
4. Para o `npm ci` do CI funcionar, o arquivo `package-lock.json` (criado pelo `npm install`) precisa ir no commit. Ele já entra no `git add .`.

### 5.2 Proteger as branches (recomendado)
No GitHub: **Settings > Branches > Add branch protection rule**, para `main` e `homologacao`:
- marque **Require a pull request before merging**
- marque **Require status checks to pass** e escolha **Lint e tipos** (aparece depois do primeiro PR)

### 5.3 Fluxo de cada mudança
```
git checkout homologacao
git pull
git checkout -b feature/nome-curto          # ex.: feature/bloco-7-base-nextjs
# ... trabalha, depois:
git add .
git commit -m "feat: descrição curta"
git push -u origin feature/nome-curto
```
Abra o **Pull Request** no GitHub: `feature/...` para `homologacao`. Quando o CI ficar verde, faça o merge.
Depois de validar em homologação, abra outro PR `homologacao` para `main`. Na `main`, crie a tag da versão (ex.: `v1.0.0`) em **Releases**.

Mensagens de commit: `feat:` (novidade), `fix:` (correção), `docs:` (documentação), `chore:` (organização).

### 5.4 O que o CI faz
- **CI** (`.github/workflows/ci.yml`): em cada PR roda `npm run lint` e `npm run typecheck`. Por enquanto são avisos vazios; ficam de verdade no Bloco 7.
- **Banco de dados** (`.github/workflows/banco.yml`, opcional): quando o PR mexe em `supabase/`, sobe o Supabase no GitHub, aplica as migrations e roda os testes SQL. Pode levar uns 5 a 10 minutos. Se atrapalhar, apague o arquivo.

## 6. Usar pelos celulares (aviso importante)
O banco em `127.0.0.1` só existe dentro do seu computador. Para testar pelo celular na mesma rede Wi-Fi:
1. Descubra o IP do computador (`ipconfig` no Windows, `ifconfig` no Mac/Linux), por exemplo `192.168.0.20`.
2. Em `.env.local`, troque `NEXT_PUBLIC_SUPABASE_URL` por `http://192.168.0.20:54321`.
3. Libere as portas 3000 e 54321 no firewall do computador.

Isso serve só para testar telas. O PWA (instalar na tela inicial e funcionar offline) exige **HTTPS** no celular, e o Supabase local usa HTTP. Isso será resolvido no **Bloco 14** (mkcert e um proxy local).

## 7. Migrar para a nuvem depois
Nada do código muda, só as variáveis do `.env`:
1. Crie um projeto em supabase.com.
2. `npx supabase login` e `npx supabase link --project-ref SEU-REF`
3. `npx supabase db push` (aplica as migrations na nuvem). **Não rode o `seed.sql` na nuvem.**
4. Troque `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` pelos valores do projeto.
5. Crie o primeiro admin manualmente (ver Bloco 2):
   ```sql
   update public.perfis set perfil = 'admin', status_cadastro = 'aprovado' where email = 'seu@email.com';
   ```

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `Cannot connect to the Docker daemon` | abra o Docker Desktop e espere ficar "Running" |
| `port is already allocated` | outro programa usa a porta; feche-o ou rode `npm run db:stop` |
| `npm run db:start` muito lento na primeira vez | normal: está baixando imagens |
| Erro de SQL ao subir | copie a mensagem inteira; não edite o banco à mão |
| `npx supabase init` diz que já existe | pode seguir para o próximo passo |
| Os testes dizem "Não encontrei o banco local" | rode `npm run db:start` e confira `docker ps` |
| Quero recomeçar do zero | `npm run db:reset` |
