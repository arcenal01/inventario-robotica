# Testes do sistema (Bloco 16A)

Três camadas de teste. As duas primeiras são automáticas; a terceira é um roteiro para fazer **no celular**, que nenhum robô substitui (câmera, toque, Wi-Fi ruim).

## 1. Testes automáticos (rodam em segundos)

| Comando | O que confere | Esperado |
|---|---|---|
| `npm test` | regras do app (filtros, schemas, importação, offline...) | `pass 82`, `fail 0` |
| `npm run typecheck` | tipos TypeScript | sem erros |
| `npm run lint` | estilo e erros comuns | sem erros |
| `npm run db:testes` | regras do banco (saldo, pedidos, contagem, código...) | 13 arquivos "sem erros e sem FALHOU" |
| `npm run build` | o app compila para produção | termina sem erro |

O `db:testes` precisa do Docker aberto e do banco no ar (`npm run db:start`).

## 2. Teste de ponta a ponta (`npm run e2e`)

Abre o sistema num navegador de verdade (Edge, sem janela) e faz o que uma pessoa faria. São 77 verificações:

- abre **21 telas** como professor no PC, como professor no celular (tela de 390 px, conferindo que não aparece rolagem para o lado) e como aluno (as telas da equipe devem mandar de volta ao Início);
- cadastra item com **prefixo próprio** (`ZABC` vira `ZABC-001`, depois `-002`), recusa prefixo inválido;
- envia **foto** e confere que aparece na lista e na ficha;
- abre a **etiqueta com QR** do item e o botão **Ler QR**;
- **importa uma planilha** (linha com código ruim é recusada), liga locais a posições, confere o estoque lançado e que importar de novo pula tudo;
- tira o estoque de um item e confere o aviso **"Acabou o estoque: repor"** no Início e na lista, depois **Não terá mais** e o aviso some;
- confere que o **aluno não consegue** importar, cadastrar nem marcar "não terá mais".

Para rodar:

```
npm run db:start        (banco no ar)
npm run producao        (numa janela: compila e sobe o site; deixe aberta)
npm install --no-save playwright-core     (só na primeira vez)
npm run e2e             (em outra janela)
```

Cada execução cria itens com nome `[E2E] ...` e um prefixo novo, para poder repetir sem conflito. Eles ficam no banco de teste. Para limpar tudo: `npm run db:reset` (**apaga todos os dados do banco local** e recria com o `seed.sql`).

Arquivos de apoio (fotos de teste, prints da etiqueta, `resultado.json`) ficam em `%TEMP%\inventario-e2e`.

O teste usa a chave pública do Supabase **local** (a de teste padrão). Não serve para a nuvem.

## 3. Roteiro no celular (faça uma vez, com o sistema no ar)

O celular precisa **abrir o site**. Pela rede da escola, `http://IP-DO-PC:3000` abre o sistema, mas **a câmera só funciona em endereço seguro (https)**. Para testar câmera, instalar como app e ler QR, use o túnel: `npm run tunel` e abra o endereço `https://...trycloudflare.com` que ele mostrar (muda a cada vez que você reinicia). A solução definitiva de https para a escola é o Bloco 16B.

Marque cada linha. Se algo falhar, anote o que apareceu na tela.

| # | Faça | Esperado | Ok |
|---|---|---|---|
| 1 | Abrir o endereço no celular e entrar como `prof@escola.local` | Início com os 4 indicadores; menu de baixo com Início, Itens, Pedidos, Empréstimos e Mais | |
| 2 | Menu do navegador > **Instalar app** / **Adicionar à tela inicial** | ícone do app na tela do celular; abre sem a barra do navegador | |
| 3 | Itens > Novo item > **Tirar ou escolher foto** | abre a câmera do celular; a foto aparece no formulário; ao salvar, aparece na lista | |
| 4 | Itens > **Importar planilha**: colar a planilha da coleta | lista o que vai entrar, avisa linhas com erro | |
| 5 | Itens > abrir um item > **Etiqueta QR** > imprimir (ou só ver na tela) | QR + código + nome + local, em 3 colunas no papel A4 | |
| 6 | Itens > **Ler QR** e apontar para a etiqueta (impressa ou na tela do PC) | abre a ficha do item certo | |
| 7 | Endereços > **Etiqueta QR** de uma posição; Contagens > nova contagem > contar lendo o QR da posição | câmera lê; a posição é reconhecida | |
| 8 | Dar saída em todo o saldo de um item consumível (Movimentações) | item aparece no Início em "Acabou o estoque: repor"; na ficha, **Não terá mais** tira o aviso | |
| 9 | **Offline:** abrir o app, esperar a mensagem de dados preparados, ligar o modo avião, consultar itens e fazer uma contagem | consulta funciona; a contagem fica "pendente" no indicador | |
| 10 | Desligar o modo avião | a contagem pendente é enviada sozinha; indicador volta a "sincronizado" | |
| 11 | Entrar como `aluno1@escola.local` no outro celular, abrir Itens | vê itens e fotos; **não** vê Novo item nem Importar planilha | |
| 12 | Aluno cria um pedido; professor aprova; gerar romaneio; entregar | pedido passa por todos os status; consumíveis dão baixa, emprestáveis viram empréstimo | |

## 4. O que ainda **não** foi testado (e precisa de você)

- **Aparelhos reais.** Tudo acima, no celular, é a linha 1 a 12 do roteiro: o `PROGRESSO.md` já registrava que nenhum celular de verdade tinha sido testado, e isso continua verdade até você marcar a tabela.
- **Impressão em etiqueta adesiva.** O teste confere que a folha é gerada, não o tamanho no papel da sua impressora.
- **Muitos usuários ao mesmo tempo** (uma turma inteira contando). O desenho prevê isso (idempotência e travas no banco), mas não houve teste de carga.
- **Sistema fora da sua máquina de testes** (computador da escola, https fixo, backup): Bloco 16B e 16C.
