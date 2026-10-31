# Movimentações e empréstimos (Bloco 9)

Telas que mexem no estoque. Todas chamam as funções do banco (RPC) criadas no Bloco 3: a tela **nunca** grava saldo direto.

## 1. Movimentações (`/movimentacoes`, professor e admin)

| Botão | Função no banco | Para quê |
|---|---|---|
| Entrada | `registrar_entrada` | material que chegou; sempre vai para uma **posição** |
| Saída | `registrar_saida` | baixa definitiva de **consumível** (emprestável sai por empréstimo) |
| Transferir | `transferir` | muda de posição; o total não muda |
| Ajustar | `ajustar` | corrige o saldo de uma posição para o que existe de verdade (motivo obrigatório) |

- O formulário mostra só os endereços onde o item tem saldo (para saída e transferência) e avisa se a quantidade passa do disponível. Em `un` só número inteiro.
- **Histórico**: as 200 mais recentes, com filtros de período (7, 30, 90 dias ou tudo), tipo e item. Mostra quem fez, quando, de onde para onde e o motivo. É imutável (o banco bloqueia alteração).
- Atalho: na ficha do item (Itens) o professor tem o botão **Registrar entrada**.

## 2. Empréstimos (`/emprestimos`)

- **Professor/admin**: Novo empréstimo (só itens emprestáveis; escolhe a posição de onde sai, quem leva, quantidade e prazo opcional), **Devolver** (pode ser parcial; volta para a posição de onde saiu ou outra) e **Marcar perdido** (motivo obrigatório; não mexe no saldo, porque o material já tinha saído).
- **Aluno**: a tela vira **Meus empréstimos** (só os próprios, pelo RLS), sem botões.
- Abas **Em aberto** e **Devolvidos e perdidos** (100 mais recentes). Busca por pessoa, turma ou item.
- **Atrasado** = tem prazo e o prazo passou (horário de Brasília, igual ao banco). Atrasados aparecem primeiro, com borda vermelha e "Atrasado N dias"; aviso no topo leva ao filtro "Só atrasados".

## 3. Reenvio seguro (idempotência)

Cada janela gera **uma** chave (`chave_idempotencia`) quando abre e usa a mesma em todas as tentativas. Se o Wi-Fi cair depois de o banco gravar e o usuário tocar de novo, o banco reconhece a chave e não registra duas vezes. A chave é gerada por `src/lib/chave.ts`, que funciona também no celular acessando por `http://IP` (onde `crypto.randomUUID` não existe).

## 4. Menu

Com mais telas, a barra de baixo do celular mostra só Início, Itens e Empréstimos, mais um botão **Mais** (página `/menu` com tudo). No computador o menu do topo mostra tudo.

## 5. Como testar

`npm run db:reset` e `npm run dev`; senha `Teste@12345`.

| # | Faça | Esperado |
|---|---|---|
| 1 | `prof@` > Movimentações > Entrada: Jumper, 10 un, numa posição | mensagem verde; aparece no histórico com +10 |
| 2 | Saída de 5 do Jumper | histórico com -5; saldo em Itens cai |
| 3 | Saída: tentar escolher Multímetro | não aparece (é emprestável) |
| 4 | Transferir 15 para outra posição; Ajustar essa posição para 14 com motivo | ficha do item mostra as duas posições |
| 5 | Empréstimos > Novo: Multímetro, Aluno Um, 2 un, prazo amanhã | aparece em Em aberto |
| 6 | Devolver 1 (deixar a posição sugerida) | status "Devolvido em parte" |
| 7 | Marcar perdido o restante, com motivo | vai para Devolvidos e perdidos |
| 8 | Entrar como `aluno1@` > Empréstimos | "Meus empréstimos", só os dele, sem botões; Movimentações não aparece no menu |

Automáticos: `npm test` (datas em Brasília, chave, atraso e ordem em `tests/emprestimos.test.mjs`), `npm run db:testes`, `npm run typecheck`, `npm run lint`, `npm run build`.
