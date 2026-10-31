import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTROS_INICIAIS, filtrarItens, formatarQuantidade, normalizar, ordenarItens } from "../src/features/itens/filtros.ts";
import { esquemaCategoria, esquemaItem, especificacoesParaJson, jsonParaEspecificacoes } from "../src/features/itens/schemas.ts";

const base = { descricao: null, categoria_id: "sen", tipo_controle: "consumivel", status: "ativo", abaixo_minimo: false };
const itens = [
  { ...base, codigo: "SEN-001", nome: "Sensor ultrassônico HC-SR04" },
  { ...base, codigo: "SEN-002", nome: "Sensor infravermelho", abaixo_minimo: true },
  { ...base, codigo: "MOT-001", nome: "Motor elétrico DC", categoria_id: "mot", descricao: "Com caixa de redução" },
  { ...base, codigo: "FER-001", nome: "Multímetro", categoria_id: "fer", tipo_controle: "emprestavel" },
  { ...base, codigo: "FER-002", nome: "Alicate antigo", categoria_id: "fer", tipo_controle: "emprestavel", status: "inativo" },
];
const f = (mudancas) => ({ ...FILTROS_INICIAIS, ...mudancas });
const codigos = (lista) => lista.map((i) => i.codigo);

test("busca ignora acentos e maiúsculas", () => {
  assert.equal(normalizar("  Motor ELÉTRICO "), "motor eletrico");
  assert.deepEqual(codigos(filtrarItens(itens, f({ busca: "eletrico" }))), ["MOT-001"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ busca: "ULTRASSONICO" }))), ["SEN-001"]);
});

test("busca por código, descrição e várias palavras", () => {
  assert.deepEqual(codigos(filtrarItens(itens, f({ busca: "sen-002" }))), ["SEN-002"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ busca: "reducao" }))), ["MOT-001"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ busca: "sensor hc" }))), ["SEN-001"]);
});

test("padrão mostra só ativos; filtros de categoria, tipo e mínimo", () => {
  assert.equal(filtrarItens(itens, FILTROS_INICIAIS).length, 4);
  assert.equal(filtrarItens(itens, f({ status: "" })).length, 5);
  assert.deepEqual(codigos(filtrarItens(itens, f({ status: "inativo" }))), ["FER-002"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ categoriaId: "sen" }))), ["SEN-001", "SEN-002"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ tipoControle: "emprestavel" }))), ["FER-001"]);
  assert.deepEqual(codigos(filtrarItens(itens, f({ soAbaixoMinimo: true }))), ["SEN-002"]);
});

test("ordem: abaixo do mínimo primeiro, depois por nome", () => {
  assert.deepEqual(codigos(ordenarItens(itens.slice(0, 4))), ["SEN-002", "MOT-001", "FER-001", "SEN-001"]);
});

test("quantidade sem zeros inúteis", () => {
  assert.equal(formatarQuantidade("7.000"), "7");
  assert.equal(formatarQuantidade(2.5), "2,5");
});

const itemValido = {
  nome: "Sensor HC-SR04", categoria_id: "x", unidade: "un", tipo_controle: "consumivel",
  descricao: "", estoque_minimo: 5, especificacoes: [], ativo: true,
};

test("item: aceita válido; 'un' exige mínimo inteiro; 'm' aceita quebrado", () => {
  assert.equal(esquemaItem.safeParse(itemValido).success, true);
  const r = esquemaItem.safeParse({ ...itemValido, estoque_minimo: 2.5 });
  assert.equal(r.success, false);
  assert.deepEqual(r.error.issues[0].path, ["estoque_minimo"]);
  assert.equal(esquemaItem.safeParse({ ...itemValido, unidade: "m", estoque_minimo: 2.5 }).success, true);
  assert.equal(esquemaItem.safeParse({ ...itemValido, estoque_minimo: -1 }).success, false);
  assert.equal(esquemaItem.safeParse({ ...itemValido, unidade: "litro" }).success, false);
});

test("item: especificações sem nome repetido", () => {
  const repetidas = [{ chave: "Tensão", valor: "5 V" }, { chave: "tensão", valor: "3,3 V" }];
  assert.equal(esquemaItem.safeParse({ ...itemValido, especificacoes: repetidas }).success, false);
});

test("especificações: lista <-> JSON do banco", () => {
  const lista = [{ chave: " Tensão ", valor: " 5 V " }, { chave: "Alcance", valor: "4 m" }];
  assert.deepEqual(especificacoesParaJson(lista), { "Tensão": "5 V", Alcance: "4 m" });
  assert.deepEqual(jsonParaEspecificacoes({ Pinos: 4, Cor: "azul", lixo: { a: 1 } }), [
    { chave: "Pinos", valor: "4" },
    { chave: "Cor", valor: "azul" },
  ]);
  assert.deepEqual(jsonParaEspecificacoes(null), []);
  assert.deepEqual(jsonParaEspecificacoes([1, 2]), []);
});

test("categoria: prefixo vira maiúsculo e só aceita 2 a 5 letras", () => {
  assert.equal(esquemaCategoria.parse({ nome: "Sensores", prefixo: " sen " }).prefixo, "SEN");
  assert.equal(esquemaCategoria.safeParse({ nome: "Sensores", prefixo: "S" }).success, false);
  assert.equal(esquemaCategoria.safeParse({ nome: "Sensores", prefixo: "SEN1" }).success, false);
});
