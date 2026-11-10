# Código com prefixo livre, importação da coleta e etiquetas de item (v0.15.3)

Liga o site de coleta (`inventario-robotica-contagem`, planilha do Google) a este sistema: os itens entram com **o mesmo código da coleta**, e as etiquetas de QR são impressas daqui.

## 1. Código do item com prefixo livre (migration 0011)

Na coleta, o prefixo é escolhido por peça e não precisa ser o da categoria (`ALI-001` e `BRE-001` são da categoria Ferramentas; `CHAV-001` tem 4 letras). O sistema passou a aceitar o mesmo estilo:

| No cadastro | Resultado |
|---|---|
| Prefixo vazio | prefixo da categoria + próximo número (igual antes): `FER-021` |
| Prefixo `ALI` | próximo número desse prefixo: `ALI-004` |
| Código completo `CHAV-001` (só a importação usa) | mantido; o contador de `CHAV` avança para não repetir |

- Prefixo: 2 a 5 letras sem acento. Número: 3 dígitos até 999, depois `ALI-1000`.
- Código completo precisa estar na forma única (`ALI-001`, não `ALI-1` nem `ALI-0001`) e não pode existir.
- Ao gerar, se o número já estiver em uso, o banco pula para o próximo livre.
- O código continua **definitivo**: editar o item ou trocar a categoria não muda.
- Na tela: Itens > **Novo item** > campo **Prefixo do código (opcional)**.

## 2. Importar a planilha de coleta

Itens > **Importar planilha** (professor e administrador).

1. Na planilha do Google, Ctrl+A, Ctrl+C e cole na caixa (ou escolha o CSV baixado). Precisa da linha de cabeçalho. Colunas usadas: Código, Nome, Quantidade, Local, Categoria, Observações (Contada só gera aviso). Status, ContadaEm e EditadoEm são ignoradas (o `#ERROR!` da coluna Status não atrapalha).
2. **Categorias**: cada categoria da planilha é ligada a uma existente (mesmo nome ou nome igual ao prefixo) ou vira uma nova, com prefixo sugerido e editável. Escolha também se os itens são consumíveis ou emprestáveis (ferramentas, equipamentos, instrumentos e kits já vêm como emprestáveis).
3. **Locais e estoque**: ligue cada local da coleta a uma posição (cadastrada antes em Endereços) para lançar a quantidade como **entrada de estoque**. Sem posição, o item é cadastrado sem estoque. Em todos os casos o local da coleta fica escrito na descrição (`Local na coleta: ARMARIO 4`).
4. **Conferir e importar**: lista do que vai entrar. Códigos já cadastrados são pulados (pode importar a mesma planilha de novo depois de completar a coleta: só entram os novos).

Linhas recusadas (aparecem em vermelho, com o número da linha): código fora do padrão, código repetido na planilha, nome vazio ou com mais de 80 caracteres, quantidade vazia, negativa ou quebrada (a importação cadastra em "un").

Se uma categoria nova não puder ser criada, nada é importado. Se a entrada de estoque de um item falhar, o item fica cadastrado e o relatório final avisa: lance a entrada pela ficha do item.

## 3. Etiquetas de item

- O QR guarda **só o código** (`ALI-001`), como nas etiquetas de endereço: vale em qualquer computador ou na nuvem, sem endereço de site.
- Etiqueta: QR + código + nome + categoria + onde está (até 2 posições, a de maior saldo primeiro).
- Onde imprimir: Itens > **Etiquetas** (todos os ativos) ou **Etiquetas dos listados** (o que a busca/filtros mostram); ficha do item > **Etiqueta QR**; fim da importação > **Etiquetas dos importados**. Rota: `/itens/etiquetas?codigos=...`, `?categoria=ID` ou `?todos=1`. Até 300 por folha.
- Itens > **Ler QR**: lê a etiqueta com a câmera e abre a ficha do item.
- As etiquetas do site de coleta **não** devem ser usadas: o QR delas guarda um link para o site de coleta. Imprima a partir daqui.

## 4. Como testar

Depois de `npm run db:reset` (aplica a 0011) e `npm run dev`:

| # | Faça | Esperado |
|---|---|---|
| 1 | Entrar como `prof@escola.local` > Itens > Novo item, prefixo vazio | código com o prefixo da categoria |
| 2 | Novo item com prefixo `ali` | `ALI-001` |
| 3 | Novo item com prefixo `A1` | erro "Use de 2 a 5 letras" |
| 4 | Importar planilha: colar a planilha da coleta | contagem de novos, linhas com erro, categorias e locais |
| 5 | Ligar um local a uma posição e importar | itens com o código da coleta; os ligados com saldo na posição |
| 6 | Importar a mesma planilha de novo | todos aparecem como "Já cadastrado"; botão desabilitado |
| 7 | Etiquetas dos importados > Imprimir | folha com QR, código, nome e local |
| 8 | Itens > Ler QR na etiqueta impressa | abre a ficha do item |

Automáticos: `npm run db:testes` (inclui `bloco15c_codigo_prefixo_livre_testes.sql`; o `bloco6` continua valendo), `npm test` (`tests/importacao.test.mjs`), `npm run typecheck`, `npm run lint`, `npm run build`.

## 5. Aviso "acabou o estoque" (v0.15.4, migration 0012)

O alerta de **estoque mínimo** saiu da tela. Agora só há um aviso: quando o item **acaba**.

- **Acabou** = item ativo que já recebeu estoque alguma vez, está com saldo zero e não tem nada emprestado. Ferramenta toda emprestada não "acabou" (vai voltar). Item cadastrado ou importado que nunca recebeu entrada não gera aviso.
- Aparece como **Acabou: repor** (vermelho) na lista de Itens, na ficha do item e no Início (indicador "Acabaram no estoque" e lista). A lista de Itens mostra esses primeiro e tem o filtro **Só os que acabaram**.
- Na ficha do item que acabou, o professor/admin escolhe: **Registrar reposição** (entrada de estoque) ou **Não terá mais** (o item não será reposto: o aviso some e ele aparece como "Não terá mais"). **Voltar a repor** desfaz.
- O mesmo controle está no cadastro do item: caixa **Repor quando acabar** (marcada por padrão).
- No banco: coluna `itens.repor` (padrão true) e coluna `esgotado` na view `vw_itens_estoque`. `estoque_minimo` e `abaixo_minimo` continuam existindo, sem uso na tela.

Teste: `bloco15d_acabou_estoque_testes.sql`. Na tela: dê saída de todo o saldo de um item > Início mostra o item em "Acabou o estoque: repor" > na ficha, **Não terá mais** > o aviso some.

No banco local, o `seed.sql` já cria itens de teste (`SEN-001`...): ao importar a planilha nele, esses códigos aparecem como "Já cadastrado". No banco real (sem seed) isso não acontece.
