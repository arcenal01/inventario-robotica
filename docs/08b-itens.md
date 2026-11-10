# Itens (Bloco 8B)

Tela para consultar o estoque, cadastrar e editar itens (com foto e especificações) e organizar as categorias.

## 1. Como os itens funcionam

- Cada item tem **código automático e definitivo**, formado por um prefixo e um contador próprio de cada prefixo: `SEN-001`, `SEN-002`, `MOT-001`. Depois do 999 vem `SEN-1000`. O prefixo é o da categoria, a não ser que se escreva outro no cadastro (`ALI` gera `ALI-001`): veja docs/15c-codigo-importacao-etiquetas.md.
- **Unidade**: `un`, `m` ou `kg`. Em `un` as quantidades (e o estoque mínimo) são inteiras.
- **Tipo de controle**: `consumivel` (a saída é baixa definitiva) ou `emprestavel` (sai por empréstimo e volta).
- **Aviso de estoque** (v0.15.4, substitui o "estoque mínimo"): quando o item **acaba** (já teve estoque, saldo zero e nada emprestado), aparece **Acabou: repor**. Na ficha, **Não terá mais** desliga o aviso daquele item (e **Voltar a repor** liga de novo); no cadastro é a caixa **Repor quando acabar**. Veja a seção 5 de docs/15c-codigo-importacao-etiquetas.md. O campo estoque mínimo continua no banco, mas a tela não usa mais.
- **Especificações**: pares nome = valor (ex.: `Tensão = 5 V`), até 20 por item.
- **Inativo**: some da lista padrão e não recebe entradas; o histórico continua.

Quem faz o quê:

| Ação | Aluno | Professor | Admin |
|---|---|---|---|
| Consultar lista, saldos e onde está guardado | sim | sim | sim |
| Cadastrar e editar itens, trocar foto | não | sim | sim |
| Criar, editar e desativar categorias | não | sim | sim |

Depois que o item tem **movimentações** (entrada, empréstimo...), a **unidade** e o **tipo de controle** não mudam mais (o banco bloqueia). Se o cadastro estava errado, inative o item e cadastre outro. Nome, descrição, categoria, mínimo, especificações e foto sempre podem mudar. Trocar a categoria **não** muda o código.

## 2. Saldo

O saldo **não é editado nesta tela**. Ele vem das posições (`saldos_por_endereco`) e só muda pelas funções de estoque (entrada, saída, transferência, ajuste, empréstimo, devolução), que ganham tela no **Bloco 9**.

Na ficha do item aparecem: total em estoque, mínimo, quanto está emprestado (só emprestáveis) e **em quais endereços** ele está, com a quantidade de cada um. O mesmo item pode estar em vários endereços.

A lista usa a view `vw_itens_estoque` (item + categoria + saldo total + emprestado + abaixo do mínimo). Ela respeita o RLS de quem consulta. Para o aluno, o valor "emprestado" só considera os próprios empréstimos.

## 3. Fotos

- Ficam no Storage do Supabase, bucket **`itens-fotos`** (leitura pública, envio só professor/admin, até 2 MB, só imagens).
- No celular, **Tirar ou escolher foto** abre a câmera. O app reduz a foto para no máximo 1024 px em JPEG (~150 KB) **antes** de enviar: economiza Wi-Fi e espaço.
- O banco guarda só o **caminho** no bucket (`<id do item>/<data>.jpg`), não a URL completa: ao migrar para a nuvem a foto continua funcionando.
- Trocar a foto apaga a antiga. Se o envio da foto falhar, o item é salvo mesmo assim e a mensagem avisa para tentar de novo.

## 4. Como testar

Com o Docker aberto, na pasta `inventario-robotica`: `npm run db:reset` (aplica a migration 0008 e o seed) e `npm run dev`. Abra http://localhost:3000 (senha de todos: `Teste@12345`).

| # | Faça | Esperado |
|---|---|---|
| 1 | Entrar como `aluno1@escola.local` e abrir **Itens** | lista com 15 itens, saldo de cada um; aviso amarelo "1 item está abaixo do estoque mínimo"; sem botão Novo item |
| 2 | Tocar no aviso amarelo | só o Sensor infravermelho (SEN-002) |
| 3 | Buscar `ultrassonico` (sem acento) | encontra o Sensor ultrassônico |
| 4 | Tocar no Arduino Uno | ficha com 6 un em estoque, guardado em ARM01-GAV01-P01 |
| 5 | Sair e entrar como `prof@escola.local` > Itens > **Novo item** | cadastra com categoria Sensores; mensagem verde mostra o código (ex.: SEN-003) |
| 6 | Editar o item novo, adicionar especificação e foto (no celular abre a câmera) | foto aparece na lista e na ficha |
| 7 | Editar o Arduino | unidade e tipo de controle ficam bloqueados (tem estoque) |
| 8 | Em `un`, tentar mínimo 2,5 | erro "precisa ser inteiro" |
| 9 | Itens > **Categorias** > Nova categoria (ex.: Displays, DSP) | aparece na lista e no cadastro de itens |
| 10 | Desmarcar "Item ativo" num item e salvar | some da lista; aparece no filtro Inativos |

Automáticos: `npm run db:testes` (inclui `bloco8b_testes.sql`: view, proteções e permissões das fotos), `npm test` (busca, filtros e validações em `tests/itens.test.mjs`), `npm run typecheck`, `npm run lint`, `npm run build`.

## 5. Decisões e limites

- Lista carregada inteira e filtrada no aparelho (uma sala tem centenas de itens): busca instantânea e, no Bloco 14, fácil de guardar para consulta offline.
- Busca ignora acentos e maiúsculas, procura em código, nome e descrição, e exige todas as palavras digitadas.
- Ordem: itens abaixo do mínimo primeiro, depois por nome.
- Item não é excluído pela tela (o histórico depende dele): use **inativo**.
- Categorias podem ser criadas e editadas por professor e admin (decisão do usuário); excluir continua só para o admin (pelo banco).
- Leitura do código pela câmera (QR do endereço) e entradas de estoque: Blocos 9 e 12.
