# PWA, cache, HTTPS e conexão (Bloco 14)

## 1. Um endereço só: o Supabase passa pelo app

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=/supabase
SUPABASE_URL_INTERNO=http://127.0.0.1:54321
```

- O navegador fala só com o app (`/supabase/...`); o app repassa ao Supabase (`next.config.ts`, rewrites).
- O celular não precisa enxergar a porta 54321. Funciona no PC, na rede da escola (`http://IP:3000`) e pelo túnel https.
- O cookie de sessão tem nome fixo (`sb-inventario-auth-token`), igual no navegador e no servidor.
- **Depois de mudar o `.env.local`, todo mundo precisa entrar de novo uma vez.**
- Nuvem (futuro): volte `NEXT_PUBLIC_SUPABASE_URL` para a URL do projeto e deixe `SUPABASE_URL_INTERNO` em branco.

## 2. PWA (instalar como app)

- Manifest (`src/app/manifest.ts`), ícones em `public/icones/` (gerados de `icone.svg`), service worker `public/sw.js`.
- O service worker só liga no app de produção (`npm run producao`) e em endereço seguro (https ou localhost).
- O que ele guarda:
  - arquivos do app (`/_next/static`, ícones): na primeira visita;
  - páginas: busca na rede; sem rede/servidor, mostra a última versão guardada; se a tela nunca foi aberta, mostra `offline.html`;
  - dados (`/supabase/...`): **nunca** guardados aqui. Dados offline e fila de envio = Bloco 15.
- Ao **Sair**, as páginas guardadas no aparelho são apagadas.
- Versão nova do app: aumente `VERSAO` em `public/sw.js` (apaga os caches antigos).

Instalar:
- **Android (Chrome)**: menu ⋮ > *Instalar app* (ou *Adicionar à tela inicial*).
- **iPhone (Safari)**: botão Compartilhar > *Adicionar à Tela de Início*.

## 3. Indicador de conexão

- Bolinha no topo: verde = conectado; amarela com texto = **Offline** (aparelho sem rede) ou **Servidor fora** (rede ok, mas o PC da sala não responde).
- Faixa amarela abaixo do topo explica a situação. Verifica a cada 30 s, ao voltar para o app e quando a rede muda.

## 4. HTTPS pelo túnel da Cloudflare (escolha do usuário)

O celular só libera câmera e instalação do app em **https**. O túnel cria um endereço https público que chega ao PC da sala, sem precisar de IP fixo nem instalar certificado nos celulares.

PC da sala (PowerShell, na pasta do projeto, Docker Desktop aberto):

```powershell
npm.cmd run db:start      # banco
npm.cmd run producao      # app (deixe a janela aberta)
# em OUTRA janela do PowerShell:
npm.cmd run tunel         # túnel; procure a linha https://....trycloudflare.com
```

Abra esse endereço https no celular.

O que fica exposto: só o app (porta 3000), incluindo o repasse `/supabase` (protegido por login + RLS). Banco (54322) e Studio (54323) **não** ficam expostos. Cadastro novo entra como pendente até um professor aprovar.

**Limitação do túnel rápido** (o de agora, sem conta): o endereço muda **toda vez** que o túnel reinicia. App instalado no celular fica preso ao endereço antigo. Para um endereço fixo é preciso um túnel nomeado: conta grátis na Cloudflare + um domínio próprio (pago, poucos reais por mês). Decisão pendente do usuário.

## 5. Como testar

| # | Faça | Esperado |
|---|---|---|
| 1 | `npm.cmd run producao` e abra http://localhost:3000 | login funciona; bolinha verde no topo |
| 2 | F12 > Application > Service workers | `sw.js` ativo |
| 3 | Abra Itens; feche o app (Ctrl+C no PowerShell); recarregue Itens | página abre do cache, faixa "Servidor fora" |
| 4 | Ainda sem servidor, abra uma tela nunca visitada | página "Sem conexão" com "Tentar de novo" |
| 5 | `npm.cmd run tunel` e abra o endereço https no celular | login, câmera em Contagens > Contar e "Instalar app" disponíveis |
| 6 | No celular, Sair | volta para Entrar no endereço do túnel |

Automáticos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
