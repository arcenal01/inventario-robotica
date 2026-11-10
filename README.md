# Inventário Robótica

Sistema web (PWA) para controlar o inventário da sala de eletrônica/robótica de uma escola.
Funciona no celular, inclusive com Wi-Fi instável (modo offline).

- Banco e autenticação: Supabase (PostgreSQL, Auth, RLS)
- Frontend: Next.js (App Router) + TypeScript + Tailwind + React Hook Form + Zod + TanStack Query

## Começar
Siga o passo a passo em [`docs/06-ambiente-local.md`](docs/06-ambiente-local.md).

```
npm install
npx supabase init     # só na primeira vez
npm run db:start
npm run db:testes
npm run dev           # abre o app em http://localhost:3000
```

## Documentação
- `docs/01-modelo-de-dados.md`: tabelas, enums e diagrama
- `docs/06-ambiente-local.md`: ambiente local, Git/GitHub e CI
- `docs/07-base-nextjs.md`: app Next.js, convenção de nomes, como testar login e aprovação
- `docs/08a-enderecos.md`: endereços, QR Code e troca de QR
- `docs/08b-itens.md`: itens, categorias, fotos e saldos
- `docs/09-movimentacoes-emprestimos.md`: entradas, saídas, transferências, ajustes e empréstimos
- `docs/10-pedidos.md`: pedidos, aprovação e notificações
- `docs/11-romaneios.md`: separação, entrega com conferência e PDF
- `docs/12-contagens.md`: contagem por QR/código, recontagem e aprovação com ajustes
- `docs/13-painel-relatorios.md`: painel do Início e relatórios em CSV/PDF
- `docs/14-pwa-https.md`: instalar como app, cache, indicador de conexão e túnel https
- `docs/15a-offline.md`: dados guardados no aparelho, consulta e contagem sem conexão, fila de envio
- `docs/15c-codigo-importacao-etiquetas.md`: código com prefixo livre, importar a planilha de coleta, etiquetas de item e aviso de "acabou o estoque"
- `docs/16a-testes.md`: testes automáticos, teste de ponta a ponta (`npm run e2e`) e roteiro no celular
- `docs/17-netlify.md`: publicar o site na Netlify com o banco no Supabase na nuvem
- `PROGRESSO.md`: o que já foi feito, decisões e pendências

## Abrir o sistema com duplo clique (Windows)
`abrir.bat` abre o Docker (se precisar), sobe o banco e o site e abre o navegador. `parar.bat` desliga o banco.
Entrar com `prof@escola.local`, senha `Teste@12345` (usuários de teste do `seed.sql`).

## Branches
`main` (produção) e `homologacao` (testes). Novidades saem de `homologacao` em `feature/*` ou `fix/*` e voltam por Pull Request.
