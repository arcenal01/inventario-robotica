// Testes das funções puras de endereços (árvore e seleção de etiquetas). Rodam com: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  compararCodigos,
  idsComDescendentes,
  montarArvore,
  selecionarParaEtiquetas,
} from "../src/features/enderecos/arvore.ts";

function e(id, codigo, pai_id = null, ativo = true) {
  return { id, codigo, pai_id, ativo, nome: null, descricao: null, numero: 0, tipo_endereco_id: "t", substituido_por_id: null, criado_em: "" };
}

const lista = [
  e("p10", "ARM01-GAV01-P10", "g1"),
  e("a1", "ARM01"),
  e("p2", "ARM01-GAV01-P02", "g1"),
  e("g1", "ARM01-GAV01", "a1"),
  e("g2", "ARM01-GAV02", "a1"),
  e("a2", "ARM02"),
  e("velho", "ARM01-GAV03", "a1", false),
];

test("ordenação natural: P02 antes de P10", () => {
  const ordenado = [e("x", "P10"), e("y", "P02"), e("z", "P1")].sort(compararCodigos).map((n) => n.codigo);
  assert.deepEqual(ordenado, ["P1", "P02", "P10"]);
});

test("montarArvore agrupa filhos sob o pai e ordena", () => {
  const arvore = montarArvore(lista);
  assert.deepEqual(arvore.map((n) => n.codigo), ["ARM01", "ARM02"]);
  const arm01 = arvore[0];
  assert.deepEqual(arm01.filhos.map((n) => n.codigo), ["ARM01-GAV01", "ARM01-GAV02", "ARM01-GAV03"]);
  assert.deepEqual(arm01.filhos[0].filhos.map((n) => n.codigo), ["ARM01-GAV01-P02", "ARM01-GAV01-P10"]);
});

test("filho cujo pai não está na lista vira raiz (não some)", () => {
  const arvore = montarArvore([e("f", "X-F", "pai-que-nao-existe")]);
  assert.equal(arvore.length, 1);
});

test("idsComDescendentes inclui o próprio e tudo dentro", () => {
  const ids = idsComDescendentes(lista, "a1");
  assert.deepEqual([...ids].sort(), ["a1", "g1", "g2", "p10", "p2", "velho"]);
  assert.deepEqual([...idsComDescendentes(lista, "p2")], ["p2"]);
});

test("etiquetas: ids, raiz, todos e novosIds; inativos nunca entram", () => {
  const codigos = (pedido) => selecionarParaEtiquetas(lista, pedido).map((n) => n.codigo);
  assert.deepEqual(codigos({ ids: ["a2", "p2"] }), ["ARM01-GAV01-P02", "ARM02"]);
  assert.deepEqual(codigos({ raiz: "g1" }), ["ARM01-GAV01", "ARM01-GAV01-P02", "ARM01-GAV01-P10"]);
  assert.equal(codigos({ todos: true }).length, 6);
  assert.deepEqual(codigos({ novosIds: ["g2", "velho"] }), ["ARM01-GAV02"]);
  assert.deepEqual(codigos({}), []);
});
