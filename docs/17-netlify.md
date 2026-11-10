# Publicar na Netlify (com Supabase na nuvem)

A Netlify hospeda o **site** (o Next.js). Ela **não roda o banco**: o banco e o login ficam no **Supabase na nuvem**. Por isso são dois serviços, e a ordem importa: primeiro o Supabase, depois a Netlify.

```
celular ──► Netlify (site, https) ──► Supabase na nuvem (banco, login, fotos)
```

Tudo abaixo tem plano gratuito. Confira os limites vigentes nos sites dos dois serviços.

## Parte 1: Supabase na nuvem (uma vez)

1. Em supabase.com, **New project**. Anote a **senha do banco** que você escolher (ela é pedida no passo 3).
2. Quando o projeto ficar pronto, anote:
   - **Project ref** (as letras do endereço `https://SEU-REF.supabase.co`);
   - em **Project Settings > API**: a **URL** e a chave **anon / publishable** (a pública). **Nunca** use a `service_role`.
3. No PC, na pasta do projeto, aplique as tabelas e regras (as migrations):
   ```
   npx supabase login
   npx supabase link --project-ref SEU-REF
   npx supabase db push
   ```
   Ele lista as migrations (0001 a 0012) e pede confirmação.
   **Não rode `supabase db reset --linked` nem o `seed.sql` na nuvem**: o seed cria usuários de teste com senha conhecida (`Teste@12345`), o que numa internet aberta é um risco.
4. Em **Authentication > Providers > Email**: decida sobre **Confirm email**.
   - Ligado: cada cadastro precisa clicar num e-mail. O e-mail embutido do Supabase tem limite baixo por hora, então para uma turma inteira é ruim, a não ser que você configure um SMTP próprio.
   - Desligado: o aluno entra logo após se cadastrar (ele continua "pendente" até o professor aprovar). **Para uma sala de aula, desligado costuma ser o mais simples.**

## Parte 2: Netlify

1. Em netlify.com: **Add new project > Import an existing project > GitHub**, escolha o repositório `inventario-robotica`.
2. **Branch to deploy**: `main` (produção). Para ensaiar antes, use `homologacao`.
3. As configurações de build já vêm do arquivo `netlify.toml` do repositório (Node 22, `npm run build`). Não precisa mudar nada.
4. Antes de publicar, em **Environment variables** (em *Site configuration*), crie **duas**:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU-REF.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave anon / publishable do passo 2 da Parte 1 |

   - **Não** crie `SUPABASE_URL_INTERNO` (isso é só para o modo local).
   - **Não** coloque a chave `service_role` em lugar nenhum.
   - Deixe valendo para **todos os contextos** (produção e prévias), senão o build das prévias falha.
   - Essas duas variáveis são gravadas dentro do site **na hora do build**. Se mudar uma, faça um novo deploy (**Deploys > Trigger deploy > Clear cache and deploy site**).
5. **Deploy**. Quando terminar, a Netlify mostra o endereço do site (`https://alguma-coisa.netlify.app`).

## Parte 3: ligar os dois (depois do primeiro deploy)

1. No Supabase, em **Authentication > URL Configuration**:
   - **Site URL**: o endereço da Netlify;
   - **Redirect URLs**: o mesmo endereço, com `/**` no final (ex.: `https://alguma-coisa.netlify.app/**`).
2. Crie o **primeiro administrador**:
   1. Abra o site e use **Cadastre-se** com o seu e-mail.
   2. No Supabase, **SQL Editor**, rode (trocando o e-mail):
      ```sql
      update public.perfis set perfil = 'admin', status_cadastro = 'aprovado' where email = 'seu@email.com';
      ```
   3. Entre no site: você é administrador. Aprove professores e alunos pela tela **Usuários**.

## Parte 4: conferir

| # | Faça | Esperado |
|---|---|---|
| 1 | Abrir o endereço da Netlify no celular | tela de login, com cadeado (https) |
| 2 | Entrar como administrador | Início, menu completo |
| 3 | Itens > Novo item > tirar foto | a câmera abre; a foto aparece na lista |
| 4 | Itens > Ler QR | a câmera abre (só funciona em https, e a Netlify já é) |
| 5 | Menu do navegador > Instalar app | ícone na tela do celular |
| 6 | Itens > Importar planilha | importa os itens da coleta |

O restante do roteiro de celular está em `docs/16a-testes.md`.

## Cuidados

- **Os dados do seu PC não vão junto.** O banco da nuvem começa vazio. Cadastre os itens ou use **Itens > Importar planilha** com a planilha da coleta.
- **Projeto gratuito do Supabase pausa** depois de alguns dias sem uso. Se o site mostrar erro de conexão depois de uma pausa, abra o projeto no painel do Supabase e clique em **Restore**. Veja a política atual no site do Supabase.
- **Backup:** o plano gratuito não garante cópias que você possa restaurar quando quiser. Isso é o Bloco 16C (backup agendado); até lá, exporte os relatórios em CSV de vez em quando.
- **Endereço fixo:** o `algo.netlify.app` não muda. Dá para trocar o nome em *Site configuration > Change site name*, ou ligar um domínio próprio. Se mudar o endereço, atualize a **Site URL** e as **Redirect URLs** no Supabase. As etiquetas de QR **não dependem do endereço do site** (guardam só o código), então trocar o endereço não invalida nenhuma etiqueta.
- **Erros de build** mais comuns: variável faltando (o build para com a mensagem "Variáveis de ambiente inválidas"); Node antigo (o `netlify.toml` já fixa o 22).
