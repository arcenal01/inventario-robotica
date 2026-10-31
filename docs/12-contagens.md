# Contagens de estoque (Bloco 12)

Usa as funções do Bloco 5 (`abrir_contagem`, `registrar_contagem`, `encerrar_contagem`, `solicitar_recontagem`, `aprovar_contagem`, `cancelar_contagem`) e duas funções novas de leitura da migration `0009_contagem_telas.sql`:

- `posicoes_da_contagem(contagem)`: posições da contagem com itens contados, itens faltando, recontagens e "você contou aqui".
- `itens_para_contar(contagem, posição)`: itens de uma posição com a situação `contar`, `contado`, `recontar` ou `recontar_outro`.

Nenhuma das duas devolve quantidades: o aluno vê o que falta contar, não o que os outros contaram.

## 1. Fluxo

`aberta → em andamento → em revisão → aprovada` (ou `cancelada`; recontagem volta para "em andamento")

1. **Abrir** (professor/admin, `/contagens` > Nova contagem): estoque inteiro, um endereço (e tudo dentro dele) ou uma categoria.
2. **Contar** (qualquer aprovado, `/contagens/[id]/contar`):
   - leia o QR da posição com a câmera ou digite o código;
   - aparecem os itens esperados **sem a quantidade do sistema**;
   - campo em branco = não contei agora (continua pendente); 0 = procurei e não achei;
   - "Achou um item que não está na lista?" adiciona item achado a mais;
   - uma posição é gravada de uma vez, com chave de idempotência (tocar duas vezes não conta duas vezes).
3. **Etiqueta antiga**: se o QR lido é de um endereço trocado (Bloco 8A), a tela avisa e oferece contar o endereço novo.
4. **Encerrar** (professor): posições vazias no sistema não precisam ser contadas; posições com material sem contagem ficam como estão; itens que ninguém contou numa posição contada viram "não listado" (contado = 0).
5. **Revisar**: sistema x contado de cada linha, só divergências por padrão. "Pedir recontagem" faz outra pessoa contar aquele item (quem contou antes não pode).
6. **Aprovar**: gera um ajuste por divergência (a diferença é somada ao saldo atual). Os ajustes aparecem em Movimentações com o motivo "Contagem CNT-...".

Empréstimos em aberto não contam como divergência; aparecem só como informação.

## 2. Câmera

- Funciona em **https** ou **localhost**. No celular pela rede (`http://IP`) o navegador bloqueia a câmera: digite o código até o Bloco 14 (HTTPS).
- Biblioteca `jsqr` (só é baixada quando a câmera abre). Lê ~6 quadros por segundo e desliga a câmera assim que lê.

## 3. Como testar

`npm run db:reset` e `npm run dev`; senha `Teste@12345`.

| # | Faça | Esperado |
|---|---|---|
| 1 | `prof@` > Mais > Contagens > Nova contagem > Um endereço > ARM01 | abre CNT-AAAA-0001 com as posições "Pendente" |
| 2 | `aluno1@` > Contagens > a contagem > Contar uma posição > digite `ARM01-GAV01-P01` | lista o Arduino sem mostrar o saldo |
| 3 | Informe 1 a menos e Registrar | "1 item(ns) registrado(s)" |
| 4 | `aluno2@` abre a mesma posição | Arduino aparece em "Já contados" |
| 5 | Digite `2.5` num item "un" | erro "Em \"un\" use número inteiro" |
| 6 | `prof@` > Encerrar e revisar | "Em revisão"; a divergência do Arduino aparece |
| 7 | Pedir recontagem; `aluno1@` abre a posição | "você contou: outra pessoa reconta" |
| 8 | `aluno2@` reconta com o valor certo; `prof@` Encerrar > Aprovar | "Aprovada"; só as divergências restantes viram ajuste |
| 9 | No PC (localhost), Ler QR com a câmera apontando para uma etiqueta impressa | abre a posição da etiqueta |

Automáticos: `npm test` (`tests/contagens.test.mjs`), `npm run db:testes` (`bloco12_testes.sql`), `npm run typecheck`, `npm run lint`, `npm run build`.
