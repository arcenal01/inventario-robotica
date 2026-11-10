# Painel e relatórios (Bloco 13)

Sem migration nova: o painel e os relatórios leem tabelas e views que já existiam, e a RLS de cada uma decide o que cada pessoa vê.

## 1. Painel (Início)

| Bloco | Professor/admin | Aluno |
|---|---|---|
| Acabaram no estoque (v0.15.4; antes "Abaixo do mínimo") | quantos itens acabaram e são para repor + lista de 5 | igual |
| Pedidos | "para aprovar" (enviados) + total em andamento | os próprios em andamento |
| Empréstimos | em aberto + quantos atrasados | os próprios |
| Contagens | em andamento (aberta, em andamento, em revisão) | igual |
| Lista da direita | últimas 6 movimentações | meus pedidos em andamento |
| Avisos | cadastros pendentes, trocas de QR | — |

Os indicadores ficam amarelos quando há algo a resolver. Cada um leva à tela correspondente.

## 2. Relatórios (`/relatorios`, professor e admin)

| Relatório | Filtros | Fonte |
|---|---|---|
| Estoque por endereço | busca por endereço ou item | `saldos_por_endereco` (só saldo > 0) |
| Movimentações por período | de/até (padrão: últimos 30 dias, horário de Brasília) e tipo | `movimentacoes` |
| Empréstimos | em aberto, atrasados, com perda ou todos; busca por pessoa/turma/item | `emprestimos` |
| Divergências de contagem | contagem (padrão: a mais recente) | `vw_contagem_divergencias` (última rodada) |

- **Baixar CSV**: abre direto no Excel em português (`;` entre colunas, vírgula decimal, acentos certos).
- **Imprimir / PDF**: imprime só a tabela com título, filtros e data de emissão; escolha "Salvar como PDF".
- A impressão sai sempre em papel branco, mesmo com o tema escuro ligado (vale também para romaneio e etiquetas).
- Limite de 5000 linhas por relatório (aviso se passar).

## 3. Como testar

`npm run db:reset` e `npm run dev`; senha `Teste@12345`. Para ter dados, faça antes um pedido, um romaneio, um empréstimo e uma contagem aprovada (docs 09 a 12).

| # | Faça | Esperado |
|---|---|---|
| 1 | `prof@` > Início | 4 indicadores; "Sensor infravermelho" em Abaixo do mínimo; últimas movimentações |
| 2 | `aluno1@` > Início | "Meus pedidos em andamento" e "Meus empréstimos"; sem movimentações nem relatórios |
| 3 | `prof@` > Relatórios > Estoque por endereço > Baixar CSV | arquivo `estoque-por-endereco-AAAA-MM-DD.csv` abre no Excel com acentos |
| 4 | Movimentações > tipo Ajuste | só ajustes; período invertido mostra "Período inválido" |
| 5 | Empréstimos > Atrasados | só os vencidos, com "Atrasado N dia(s)" |
| 6 | Divergências > Imprimir / PDF | folha branca com título, contagem, tabela e totais |
| 7 | `aluno1@` digitar `/relatorios` | volta para o Início |

Automáticos: `npm test` (`tests/relatorios.test.mjs`), `npm run typecheck`, `npm run lint`, `npm run build`.
