import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparCategorias,
  agruparLocais,
  lerNumero,
  lerPlanilha,
  montarDescricao,
  planejarItens,
  sugerirPrefixo,
  tipoControleSugerido,
  validarCategorias,
} from "../src/features/itens/importacao.ts";
import { selecionarItensParaEtiquetas, textoLocal } from "../src/features/itens/etiquetas.ts";
import { esquemaItem, REGEX_CODIGO_ITEM } from "../src/features/itens/schemas.ts";

// Trecho real da planilha de coleta (copiado do Google: colunas separadas por TAB)
const CAB = "Código\tNome\tQuantidade\tLocal\tCategoria\tObservações\tContada\tStatus\tContadaEm\tEditadoEm";
const PLANILHA = [
  CAB,
  "CHAV-001\tCHAVE PHILIPS E DE FENDA CABO IS\t12\tARMARIO 4 GAVETA C2\tCHAV\t\t\t#ERROR!\t\t2026-10-29T17:37:01.568Z",
  "MUL-001\tMultímetro Analógico\t1\tArmario 4 Caixa F\tEquipamento\t\t\t#ERROR!\t\t2026-10-29T17:12:27.366Z",
  "ALI-001\tALICATE DE CORTE RENTE\t16\tARMARIO 4\tFerramentas\t\t\t#ERROR!\t\t2026-11-05T17:24:51.265Z",
  "FER-001\tCHAVE PHILIPS PUNHAL DE PLASTICO\t8\tARMARIO 4\tFerramentas\t\t\t#ERROR!\t\t2026-10-29T17:33:36.664Z",
  "QUI-001\tCAIXA DE PERCLORETO DE ANIDRO\t6\tARMARIO 4\tQUÍMICO\t\t\t#ERROR!\t\t2026-10-29T17:47:11.655Z",
  "EQU-014\tESTAÇÃO DE SOLDA\t5\tARMARIO 6\tEquipamento\tSUGON T26D\t4\t#ERROR!\t\t2026-11-05T17:22:49.397Z",
  "CAI-002\tCAIXA DE FERRAMENTA- 02\t1\tBancada eletrônica\tKIT\tPINÇA PONTA FINA ANGULADA, FLUXO PASTOSO\t\t#ERROR!\t\t2026-10-29T18:55:22.442Z",
].join("\n");

test("lê a planilha colada do Google (TAB) e ignora Status/datas", () => {
  const { linhas, erros } = lerPlanilha(PLANILHA);
  assert.deepEqual(erros, []);
  assert.equal(linhas.length, 7);
  assert.deepEqual(linhas[0], {
    linha: 2, codigo: "CHAV-001", nome: "CHAVE PHILIPS E DE FENDA CABO IS", quantidade: 12,
    local: "ARMARIO 4 GAVETA C2", categoria: "CHAV", obs: "", contada: null,
  });
  assert.equal(linhas[5].obs, "SUGON T26D");
  assert.equal(linhas[5].contada, 4);
});

test("lê CSV com ponto e vírgula e aspas", () => {
  const csv = 'Código;Nome;Quantidade;Local;Categoria;Observações\r\nFER-020;"ESPONJA; DE BRONZE";4;ARMARIO 6;Ferramentas;"tem ""duas"" caixas"\r\n';
  const { linhas, erros } = lerPlanilha(csv);
  assert.deepEqual(erros, []);
  assert.equal(linhas[0].nome, "ESPONJA; DE BRONZE");
  assert.equal(linhas[0].obs, 'tem "duas" caixas');
});

test("linhas com problema não entram e dizem o motivo", () => {
  const texto = [
    CAB,
    "ALI-1\tSem zeros\t1\tA\tX",
    "ALI-002\tBom\t2\tA\tX",
    "ALI-002\tRepetido\t3\tA\tX",
    "ALI-003\tSem quantidade\t\tA\tX",
    "ALI-004\tQuebrado\t2,5\tA\tX",
    "\t\t\t\t", // linha vazia de fórmula
  ].join("\n");
  const { linhas, erros } = lerPlanilha(texto);
  assert.deepEqual(linhas.map((l) => l.codigo), ["ALI-002"]);
  assert.deepEqual(erros.map((e) => e.linha), [2, 4, 5, 6]);
  assert.match(erros[1].motivo, /repetido.*linha 3/);
});

test("cabeçalho sem as colunas obrigatórias", () => {
  const { linhas, erros } = lerPlanilha("A\tB\nALI-001\tx");
  assert.equal(linhas.length, 0);
  assert.match(erros[0].motivo, /codigo, nome, quantidade/);
});

test("números no formato brasileiro", () => {
  assert.equal(lerNumero("1.234"), 1234);
  assert.equal(lerNumero("2,5"), 2.5);
  assert.equal(lerNumero("1.234,5"), 1234.5);
  assert.equal(lerNumero(""), null);
  assert.ok(Number.isNaN(lerNumero("doze")));
});

test("categorias: usa a existente pelo nome ou prefixo; senão sugere nova sem repetir prefixo", () => {
  const { linhas } = lerPlanilha(PLANILHA);
  const existentes = [
    { id: "fer", nome: "Ferramentas", prefixo: "FER" },
    { id: "equ", nome: "Equipamentos", prefixo: "EQU" },
    { id: "qui", nome: "Químicos", prefixo: "QUI" },
  ];
  const grupos = agruparCategorias(linhas, existentes);
  const porTexto = Object.fromEntries(grupos.map((g) => [g.texto, g]));
  assert.deepEqual(porTexto["Ferramentas"].destino, { tipo: "existente", categoriaId: "fer" });
  // "QUÍMICO" não é igual a "Químicos" (nome) nem a "QUI" (prefixo): vira nova, com prefixo livre
  assert.deepEqual(porTexto["QUÍMICO"].destino, { tipo: "nova", nome: "QUÍMICO", prefixo: "QUIM" });
  assert.deepEqual(porTexto["CHAV"].destino, { tipo: "nova", nome: "CHAV", prefixo: "CHA" });
  assert.equal(porTexto["Equipamento"].destino.tipo, "nova"); // "Equipamento" != "Equipamentos"
  assert.equal(porTexto["Equipamento"].destino.prefixo, "EQUI"); // EQU já é usado
  assert.equal(porTexto["Ferramentas"].tipoControle, "emprestavel");
  assert.equal(porTexto["CHAV"].tipoControle, "consumivel");
  assert.deepEqual(validarCategorias(grupos, existentes), []);
});

test("categorias novas: avisa prefixo repetido, inválido e nome que já existe", () => {
  const existentes = [{ id: "fer", nome: "Ferramentas", prefixo: "FER" }];
  const nova = (texto, nome, prefixo) => ({ texto, quantidadeItens: 1, tipoControle: "consumivel", destino: { tipo: "nova", nome, prefixo } });
  const problemas = validarCategorias([nova("A", "Alfa", "FER"), nova("B", "Beta", "B1"), nova("C", "ferramentas", "FRR"), nova("D", "Delta", "DEL"), nova("E", "Eco", "DEL")], existentes);
  assert.equal(problemas.length, 4);
  assert.match(problemas[0], /FER já é usado/);
  assert.match(problemas[1], /B1 inválido/);
  assert.match(problemas[2], /já existe a categoria Ferramentas/);
  assert.match(problemas[3], /DEL já é usado/);
});

test("sugestão de prefixo e tipo de controle", () => {
  assert.equal(sugerirPrefixo("Químico", new Set()), "QUI");
  assert.equal(sugerirPrefixo("Químico", new Set(["QUI", "QUIM"])), "QUIMI");
  assert.equal(sugerirPrefixo("", new Set()), "CAT");
  assert.equal(tipoControleSugerido("EQUIPAMENTO"), "emprestavel");
  assert.equal(tipoControleSugerido("Químico"), "consumivel");
});

test("plano: pula código já cadastrado, avisa contagem diferente e guarda o local na descrição", () => {
  const { linhas } = lerPlanilha(PLANILHA);
  const plano = planejarItens(linhas, new Set(["ALI-001"]));
  assert.equal(plano.find((i) => i.codigo === "ALI-001").situacao, "ja_existe");
  assert.equal(plano.filter((i) => i.situacao === "novo").length, 6);
  const estacao = plano.find((i) => i.codigo === "EQU-014");
  assert.equal(estacao.descricao, "SUGON T26D\nLocal na coleta: ARMARIO 6");
  assert.match(estacao.avisoContagem, /contados 4/);
  assert.equal(montarDescricao("", ""), null);
  assert.equal(montarDescricao("x".repeat(600), "A").length, 500);
});

test("locais agrupados sem diferenciar maiúsculas e acentos", () => {
  const { linhas } = lerPlanilha([CAB, "AAA-001\tUm\t1\tArmário 4\tX", "AAA-002\tDois\t1\tARMARIO 4\tX"].join("\n"));
  assert.deepEqual(agruparLocais(linhas), [{ texto: "Armário 4", quantidadeItens: 2 }]);
});

test("código completo do item: 3 dígitos até 999, depois sem zero à esquerda", () => {
  for (const ok of ["ALI-001", "CHAV-020", "FER-999", "FER-1000", "ABCDE-123"]) assert.ok(REGEX_CODIGO_ITEM.test(ok), ok);
  for (const ruim of ["ALI-1", "ALI-0001", "A-001", "ABCDEF-001", "AL1-001", "ALI001"]) assert.ok(!REGEX_CODIGO_ITEM.test(ruim), ruim);
});

test("item: prefixo do código opcional, vira maiúsculo, 2 a 5 letras", () => {
  const base = { nome: "Alicate", categoria_id: "x", unidade: "un", tipo_controle: "consumivel", descricao: "", especificacoes: [], ativo: true };
  assert.equal(esquemaItem.parse(base).prefixo_codigo, "");
  assert.equal(esquemaItem.parse({ ...base, prefixo_codigo: " ali " }).prefixo_codigo, "ALI");
  assert.equal(esquemaItem.safeParse({ ...base, prefixo_codigo: "A" }).success, false);
  assert.equal(esquemaItem.safeParse({ ...base, prefixo_codigo: "AL1" }).success, false);
  assert.equal(esquemaItem.safeParse({ ...base, prefixo_codigo: "ÁLI" }).success, false);
});

test("etiquetas de itens: por código (na ordem pedida), por categoria ou todos os ativos", () => {
  const itens = [
    { id: "1", codigo: "ALI-010", nome: "a", categoria_id: "fer", status: "ativo" },
    { id: "2", codigo: "ALI-002", nome: "b", categoria_id: "fer", status: "ativo" },
    { id: "3", codigo: "MUL-001", nome: "c", categoria_id: "equ", status: "ativo" },
    { id: "4", codigo: "BRE-001", nome: "d", categoria_id: "fer", status: "inativo" },
  ];
  const ids = (l) => l.map((i) => i.codigo);
  assert.deepEqual(ids(selecionarItensParaEtiquetas(itens, { codigos: ["mul-001", "BRE-001", "XXX-001", "MUL-001"] })), ["MUL-001", "BRE-001"]);
  assert.deepEqual(ids(selecionarItensParaEtiquetas(itens, { categoriaId: "fer" })), ["ALI-002", "ALI-010"]);
  assert.deepEqual(ids(selecionarItensParaEtiquetas(itens, { todos: true })), ["ALI-002", "ALI-010", "MUL-001"]);
  assert.deepEqual(selecionarItensParaEtiquetas(itens, {}), []);
});

test("local na etiqueta: maior saldo primeiro, até 2 e +N", () => {
  assert.equal(textoLocal([]), "");
  assert.equal(textoLocal([{ codigo: "ARM01-P02", quantidade_atual: 3 }, { codigo: "ARM01-P01", quantidade_atual: 9 }]), "ARM01-P01, ARM01-P02");
  assert.equal(
    textoLocal([
      { codigo: "A", quantidade_atual: 1 },
      { codigo: "B", quantidade_atual: 2 },
      { codigo: "C", quantidade_atual: 3 },
      { codigo: "D", quantidade_atual: 0 },
    ]),
    "C, B +1",
  );
});
