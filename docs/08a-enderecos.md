# Endereços (Bloco 8A)

Tela para ver, criar e organizar os endereços da sala, com etiquetas de QR Code imprimíveis e a regra de troca de QR.

## 1. Como os endereços funcionam

Um endereço é uma árvore, por exemplo: `ARM01-GAV03-CX02-P05`.

| Nível | Tipo (exemplo) | Observação |
|---|---|---|
| 1 | Armário (ARM), Estante (EST) | pode haver vários tipos no mesmo nível |
| 2 | Gaveta (GAV), Prateleira (PRA) | |
| 3 | Caixa (CX) | opcional: pode-se ir direto de gaveta para posição |
| 4 | Posição (P) | é aqui que os itens ficam guardados |

- O **administrador** cria e edita os tipos (nome, prefixo, nível) em Endereços > Tipos de endereço. Pode inventar tipos novos.
- **Professor e administrador** criam endereços (inclusive vários de uma vez, ex.: 10 posições) e editam nome e descrição.
- O **código** é gerado pelo banco e nunca muda. Todos os usuários aprovados podem consultar e imprimir etiquetas.
- Desativar um endereço só é possível se não houver estoque nele e nada ativo dentro dele.

## 2. QR Code

O QR guarda **só o código** (`ARM01-GAV03-CX02-P05`), sem endereço de site. Assim a etiqueta continua valendo se o sistema mudar de computador ou for para a nuvem. A leitura pela câmera dentro do app (contagens, retiradas) vem nos Blocos 9 e 12; a câmera comum do celular mostra o código como texto.

Etiquetas: botão **Etiqueta QR** (só deste endereço), **Etiquetas de tudo dentro** (ele e tudo que está dentro) e **Todas as etiquetas**. A página de impressão esconde menus e usa 3 colunas no A4.

## 3. Troca de QR (quando um endereço muda de lugar)

Como o código mostra o caminho e é definitivo, **mover** um endereço (ex.: uma caixa vai para outra gaveta) funciona assim:

1. Professor/admin toca em **Mover**, escolhe o novo lugar e (opcional) o motivo.
2. O banco cria endereços **novos** com tudo que está dentro (caixa e posições), com códigos novos.
3. O estoque é **transferido automaticamente** para as posições novas (fica no histórico de movimentações como transferência).
4. Os endereços antigos ficam inativos, marcados como "Substituído por ...", e não podem ser reativados.
5. Abre-se uma **requisição de troca de QR** (Endereços > Trocas de QR): aparece no início e em Endereços para professores e administradores, e gera notificação para eles.
6. Alguém imprime as etiquetas novas, troca no estoque e toca em **Etiquetas trocadas** para concluir.

Bloqueios (para não bagunçar o trabalho em andamento): não move se há **contagem em andamento** que inclua o endereço ou **romaneio aberto** retirando itens dele. Também não move para dentro de si mesmo nem para onde já está.

Só renomear ou mudar a descrição **não** troca o QR.

## 4. Como testar

Depois de `npm install`, `npm run db:reset` (aplica a migration 0005) e `npm run dev`:

| # | Faça | Esperado |
|---|---|---|
| 1 | Entrar como `aluno1@escola.local` e abrir Endereços | vê a árvore, sem botões de criar/editar; consegue abrir Etiqueta QR |
| 2 | Entrar como `prof@escola.local`, abrir um armário e tocar em Novo dentro | cria; o código aparece na mensagem verde |
| 3 | Criar 5 posições de uma vez (Quantos criar = 5) | 5 códigos em sequência |
| 4 | Tocar em Etiquetas de tudo dentro | folha com QR de cada endereço; Imprimir mostra só as etiquetas |
| 5 | Mover uma caixa para outra gaveta | aviso "X agora é Y"; antigo aparece como Substituído (marque "Mostrar inativos") |
| 6 | Abrir Início e Endereços | aviso de troca de QR pendente |
| 7 | Em Trocas de QR, tocar em Imprimir etiquetas novas e depois Etiquetas trocadas | troca vai para Concluídas e o aviso some |
| 8 | Entrar como `admin@escola.local` > Tipos de endereço | cria um tipo novo (ex.: Bancada, BAN, nível 1) |
| 9 | Tentar mover uma caixa durante uma contagem aberta | mensagem de bloqueio |

Automáticos: `npm run db:testes` (inclui `bloco8a_testes.sql`), `npm test` (árvore e schemas), `npm run typecheck`, `npm run lint`, `npm run build`.

## 5. Decisões e limites

- Mover vale para qualquer endereço que não seja de primeiro nível (um armário não tem "pai" para onde ir).
- O número de endereços carregados de uma vez não tem paginação: serve para uma sala (centenas). Se crescer muito, paginamos.
- Etiqueta física antiga de um endereço substituído deixa de ser válida; o app não a reconhecerá como ativa (o leitor de QR, no Bloco 12, deve avisar "etiqueta antiga" e indicar o código novo).
