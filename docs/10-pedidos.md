# Pedidos e notificações (Bloco 10)

Alunos (e professores) pedem material; o professor aprova, rejeita ou ajusta as quantidades. Usa as funções do Bloco 4: `salvar_pedido`, `enviar_pedido`, `decidir_pedido`, `cancelar_pedido`, `concluir_pedido`.

## 1. Fluxo

`rascunho → enviado (aguardando aprovação) → aprovado / rejeitado → separado → entregue → concluído` (ou `cancelado`)

| Quem | Pode |
|---|---|
| Autor (qualquer usuário aprovado) | criar, salvar rascunho, editar rascunho, enviar, cancelar enquanto rascunho ou aguardando aprovação |
| Professor/admin | aprovar (mudando quantidades; 0 tira o item), rejeitar (motivo obrigatório, o aluno vê), cancelar até "separado", concluir depois da entrega |

- **Novo pedido** (`/pedidos/novo`): finalidade (obrigatória), projeto ou turma (vem preenchido com a turma do cadastro) e o "carrinho": busca o item, toca para adicionar, informa quantidade e observação. Pode misturar consumíveis e emprestáveis. Se pedir mais do que há em estoque, aparece um aviso (o professor ajusta na aprovação).
- **Salvar rascunho** guarda sem enviar; **Enviar para aprovação** notifica professores e admins.
- A página do pedido (`/pedidos/<id>`) mostra itens (com a quantidade aprovada quando mudou), romaneio, histórico de status (quem e quando) e os botões permitidos.
- **Separação e entrega** acontecem pelo romaneio (Bloco 11). **Concluir** só funciona quando os emprestáveis do pedido voltaram (o banco confere).
- Lista (`/pedidos`): abas **Em andamento** e **Encerrados**, busca por código, finalidade, aluno ou turma. A equipe vê os pedidos de todos (menos rascunhos alheios) e um aviso com quantos aguardam aprovação. Aluno vê **Meus pedidos**.
- Pedido novo usa uma chave de idempotência: tocar duas vezes ou reenviar com Wi-Fi ruim não cria pedido repetido (base para o modo offline do Bloco 15).

## 2. Notificações (sino)

- O sino no topo mostra quantas não lidas o usuário tem (atualiza a cada minuto e ao voltar para a aba).
- `/notificacoes`: últimas 50; tocar marca como lida e abre a tela relacionada (pedido, trocas de QR, romaneio). Botão **Marcar todas como lidas**.
- Quem recebe o quê (gravado pelo banco): professor/admin recebem "Novo pedido" e "Troca de QR"; o autor recebe aprovado, rejeitado, separado, entregue e cancelado (por outra pessoa).

## 3. Como testar

`npm run db:reset` e `npm run dev`; senha `Teste@12345`.

| # | Faça | Esperado |
|---|---|---|
| 1 | `aluno1@` > Pedidos > Novo pedido: finalidade, LED 10 un e Arduino 2 un > Salvar rascunho | página do pedido PED-AAAA-0001, "Rascunho", botões Editar/Enviar/Cancelar |
| 2 | Editar, mudar LED para 12 > Enviar para aprovação | "Aguardando aprovação"; botões somem (menos Cancelar) |
| 3 | `prof@` | sino com 1; Pedidos mostra aviso "1 pedido aguarda aprovação" |
| 4 | Abrir o pedido > Aprovar, LED = 8 | "Aprovado"; LED aparece riscado 12 e 8 |
| 5 | `aluno1@` | sino com 1 ("Pedido aprovado"); tocar abre o pedido |
| 6 | Novo pedido enviado > `prof@` Rejeitar sem motivo | erro pedindo o motivo; com motivo, "Rejeitado" e o aluno vê o motivo |
| 7 | `aluno2@` | não vê os pedidos do aluno1 |

Automáticos: `npm test` (regras de botões, carrinho e aprovação em `tests/pedidos.test.mjs`), `npm run db:testes` (`bloco4_testes.sql` cobre as funções), `npm run typecheck`, `npm run lint`, `npm run build`.
