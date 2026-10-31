# Romaneios (Bloco 11)

O romaneio é a lista de retirada: **o que** pegar, **quanto** e **em qual endereço**. Usa as funções do Bloco 4: `gerar_romaneio_do_pedido`, `gerar_romaneio_avulso`, `marcar_item_separado`, `concluir_separacao`, `entregar_romaneio`, `cancelar_romaneio`. Só professor e admin acessam `/romaneios`.

## 1. Fluxo

`gerado → em separação → separado → entregue` (ou `cancelado`)

1. **Gerar**
   - Do pedido: abra o pedido **aprovado** e toque em **Gerar romaneio**. Se houver emprestáveis, dá para informar até quando devem voltar. O banco escolhe os endereços **com mais saldo primeiro** (menos paradas) e pode dividir um item em vários endereços. Um pedido só tem um romaneio ativo por vez.
   - Avulso (`/romaneios/novo`, ex.: kit para competição): descrição, prazo opcional e, para cada item, de qual endereço sai e quanto.
2. **Separar**: a tela lista as linhas **agrupadas pelo armário/estante** (primeiro nível do código) e em ordem de endereço (P02 antes de P10). Toque em cada linha quando pegar o material (fica verde com ✓). **Concluir separação** só libera com todas marcadas; o pedido vira "Separado" e o aluno é avisado.
3. **Entregar**: escolha **quem recebeu** (padrão: quem fez o pedido) e confira cada linha (padrão: o separado; pode diminuir, 0 = não entregou). Só o conferido é baixado:
   - consumível → **saída** do estoque;
   - emprestável → **empréstimo** para quem recebeu (com o prazo do romaneio).
   Tudo numa transação: se o saldo mudou desde a separação, **nada** é baixado e aparece o erro. A entrega tem chave de idempotência (tocar duas vezes não baixa duas vezes).
4. Pedido só com consumíveis vai direto para **Concluído**. Com emprestáveis fica **Entregue** até as devoluções; aí o professor toca em **Concluir pedido**.
5. **Cancelar** romaneio (antes da entrega): o pedido volta para "Aprovado" e pode gerar outro.

Lembrete (decisão do Bloco 4): o saldo **não é reservado** ao gerar o romaneio; só baixa na entrega.

## 2. PDF

**Imprimir / PDF** abre a folha do romaneio (cabeçalho, tabela por endereço com quadradinho de separação e coluna "Conferido", linhas de assinatura de quem separou e de quem recebeu). Toque em **Imprimir** e escolha **Salvar como PDF** como impressora (funciona no computador e no celular). Menus e botões não aparecem na impressão.

## 3. Como testar

`npm run db:reset` e `npm run dev`; senha `Teste@12345`. Antes, crie e aprove um pedido (ver `docs/10-pedidos.md`) com LED e Arduino.

| # | Faça | Esperado |
|---|---|---|
| 1 | `prof@` > pedido aprovado > Gerar romaneio (prazo opcional) | abre ROM-AAAA-0001 "Gerado", linhas agrupadas por ARM01/ARM02 |
| 2 | Tocar em Concluir separação | botão desabilitado até marcar todas |
| 3 | Marcar todas e Concluir separação | "Separado"; o aluno recebe "Pedido separado" |
| 4 | Imprimir / PDF | folha com tabela e assinaturas; Imprimir > Salvar como PDF |
| 5 | Entregar: conferir LED com 1 a menos | "Entregue"; saldo do LED cai só o conferido; Arduino aparece em Empréstimos do aluno |
| 6 | Pedido: Concluir pedido antes de devolver | erro "Ainda há empréstimos em aberto" |
| 7 | Empréstimos > Devolver os Arduinos > Pedido > Concluir | "Concluído" |
| 8 | Romaneios > Novo avulso com quantidade maior que o saldo | erro de saldo; com quantidade válida gera; Cancelar romaneio |
| 9 | `aluno1@` | não vê Romaneios no menu; no pedido aparece o código do romaneio |

Automáticos: `npm test` (ordem de separação, grupos e conferência em `tests/romaneios.test.mjs`), `npm run db:testes` (`bloco4_testes.sql`), `npm run typecheck`, `npm run lint`, `npm run build`.
