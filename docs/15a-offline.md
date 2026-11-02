# Uso offline: dados no aparelho e fila da contagem (Bloco 15A)

Escolhas do usuário: offline só para **consulta** (itens, saldos, endereços, contagens) e **contagem**; recusas vão para uma lista de pendências (tela completa no 15B); cada pessoa usa o próprio celular (mesmo assim, Sair apaga os dados).

## 1. O que fica guardado no aparelho

Banco no navegador (IndexedDB, biblioteca **Dexie**), um por usuário: `inventario-<id do usuário>`.

| Tabela | O que guarda |
|---|---|
| `consultas` | cópia das consultas de itens, categorias, endereços, tipos de endereço, saldos por item e contagens (posições e itens de cada posição) |
| `fila` | posições contadas sem conexão, esperando envio (ou recusadas, com o motivo) |
| `meta` | `preparado_em`: quando os dados foram baixados pela última vez |

Pedidos, empréstimos, movimentações, notificações e relatórios **não** são guardados: precisam de conexão.

## 2. Como os dados chegam ao aparelho (sozinho)

`src/features/offline/dados-offline.tsx`, em todas as telas logadas:
- ao abrir o app (e a cada 10 min, e quando a conexão volta), baixa itens, categorias, endereços, saldos de todos os itens e, para cada contagem **recebendo contagens**, as posições e os itens de **todas** as posições (função nova `itens_para_contar_todos`, migration 0010);
- pede ao service worker para guardar as páginas Início, Itens, Endereços, Contagens e as páginas de cada contagem aberta (com os arquivos delas), e carrega o leitor de QR;
- cópias com mais de 30 dias são descartadas.

Sem conexão, as telas mostram a cópia guardada e a faixa amarela diz de quando são os dados.

## 3. Contar sem conexão

1. Na tela de contar, sem rede (ou se o envio falhar por rede/servidor fora), a posição vai para a **fila do aparelho**, com a mesma chave de idempotência.
2. A faixa azul mostra "N contagens guardadas neste aparelho" e o botão **Enviar agora**.
3. Os itens já guardados aparecem como "guardado neste aparelho (falta enviar)": não dá para contar duas vezes.
4. Quando a conexão volta (evento do navegador, a cada 20 s ou ao voltar para o app), a fila é enviada em ordem:
   - aceito (ou "duplicada" = já tinha chegado) → sai da fila; faixa verde "enviada";
   - falha de rede/servidor → fica na fila e tenta depois;
   - recusa do banco (ex.: contagem já em revisão, item já contado por outra pessoa) → fica como **Recusada** com o motivo (faixa vermelha e lista na tela de contar). Corrigir/descartar: tela **Pendências** (seção 7, Bloco 15B).
5. Um envio por vez, também entre abas (Web Locks quando disponível). Reenviar nunca duplica: o banco reconhece a chave.

Observação: a divergência é calculada com o saldo do momento em que a contagem **chega** ao servidor (igual a contar online e enviar naquele instante).

## 4. Sair

Ao tocar em Sair: tenta enviar a fila; se ainda sobrar algo, pergunta antes (o que não foi enviado seria perdido). Depois apaga as páginas guardadas e o banco do aparelho.

## 5. Arquivos

- `supabase/migrations/0010_contagem_offline.sql`, `supabase/testes/bloco15_testes.sql`
- `src/features/offline/`: `regras.ts` (puro, testado), `banco.ts` (Dexie), `fila.ts` (fila, envio, contexto), `preparar.ts`, `dados-offline.tsx`, `aviso-fila.tsx`
- Alterados: consultas de itens/endereços/contagens viraram `queryOptions` (mesma consulta na tela e na preparação); tela de contar (fila); listas de itens, endereços e contagens mostram a cópia em vez de erro; `form-sair.tsx`; `pwa.tsx` (texto do aviso); `public/sw.js` (v0.15.0, mensagem "guardar", manifest do cache); layout `(app)`
- Testes: `tests/offline.test.mjs`

## 6. Como testar

| # | Faça | Esperado |
|---|---|---|
| 1 | Professor abre uma contagem. Aluno entra com `npm.cmd run producao` rodando e espera uns 5 s | F12 > Application > IndexedDB > `inventario-...` com `consultas` preenchida |
| 2 | Feche o app (Ctrl+C no PowerShell) e abra Itens | lista aparece; faixa "Servidor fora" com "dados guardados neste aparelho" |
| 3 | Ainda sem servidor: Contagens > contagem > Contar, escolha a posição, preencha e registre | "guardado(s) neste aparelho"; faixa azul "1 contagem guardada" |
| 4 | Abra a mesma posição | item como "guardado neste aparelho (falta enviar)" |
| 5 | Ligue o app de novo (`npm.cmd run start`) | em até 20 s a faixa verde "1 contagem guardada foi enviada"; professor vê a linha na contagem |
| 6 | Sair com algo na fila | pergunta antes; depois o banco `inventario-...` some do F12 |

Automáticos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:testes`.

## 7. Pendências: resolver contagens recusadas (Bloco 15B)

Tela **/pendencias** ("Pendências deste aparelho"), aberta pelos links "Ver" e "Ver e resolver" das faixas azul e vermelha e pela tela de contar. Funciona sem conexão (lê só o aparelho).

| Situação | O que a tela oferece |
|---|---|
| Aguardando envio | **Enviar agora** (todas) e **Descartar** (uma) |
| Recusada, dá para corrigir (item já contado por outra pessoa, recontagem que precisa ser de outra pessoa, item fora da categoria, quantidade inválida) | **Corrigir**: o item citado no motivo vem em branco e destacado; branco = tira o item; **Salvar e enviar** manda com chave NOVA. Também **Tentar de novo** e **Descartar** |
| Recusada, não adianta corrigir (contagem encerrada/cancelada, posição fora da contagem, sem permissão) | dica explicando; **Tentar de novo** e **Descartar** (sem Corrigir) |

- Cada recusa mostra o motivo do banco e uma dica em português simples (`dicaRecusa` em `regras.ts`, testada).
- Recusada não gravou nada no banco; por isso "Tentar de novo" pode usar a mesma chave. Corrigir troca a chave porque o conteúdo mudou.
- Descartar pede confirmação (o que foi contado ali se perde).
- A tela não está no menu: só tem algo quando há pendências, e as faixas de aviso sempre levam até ela.

Arquivos: `src/app/(app)/pendencias/page.tsx`, `src/features/offline/painel-pendencias.tsx`; ações `descartarEnvio`, `reenviarEnvio`, `corrigirEnvio` e `useFilaComEstado` em `fila.ts`.

| # | Faça | Esperado |
|---|---|---|
| 7 | Sem servidor, aluno 1 conta uma posição; com conexão, aluno 2 conta um dos mesmos itens; religue o servidor | faixa vermelha "1 contagem guardada foi recusada" |
| 8 | Toque em "Ver e resolver" > Corrigir | item do conflito em branco e destacado, o resto mantido |
| 9 | Salvar e enviar | "1 enviada(s)"; professor vê o item do aluno 2 e os demais do aluno 1 |
| 10 | Numa recusada de contagem encerrada | sem Corrigir; Descartar pede confirmação e limpa |
