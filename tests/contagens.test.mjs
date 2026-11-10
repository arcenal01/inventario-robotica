import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPosicoes,
  ajustesPrevistos,
  linhasAtuais,
  planoEncerramento,
  podeContarItem,
  prepararContagem,
  recebeContagens,
  resumoPosicoes,
  situacaoPosicao,
} from "../src/features/contagens/regras.ts";
import { normalizarCodigo, resolverEndereco } from "../src/features/leitor/codigo-endereco.ts";

const pos = (codigo, campos = {}) => ({
  endereco_id: codigo,
  codigo,
  nome: null,
  ativo: true,
  itens_contados: 0,
  itens_faltando: 0,
  recontagens: 0,
  sem_contagem: true,
  contada_por_mim: false,
  ...campos,
});

test("situação da posição: recontar > pendente/vazia > parcial/contada", () => {
  assert.equal(situacaoPosicao(pos("A", { itens_faltando: 2 })), "pendente");
  assert.equal(situacaoPosicao(pos("A")), "vazia");
  assert.equal(situacaoPosicao(pos("A", { sem_contagem: false, itens_contados: 1, itens_faltando: 1 })), "parcial");
  assert.equal(situacaoPosicao(pos("A", { sem_contagem: false, itens_contados: 2 })), "contada");
  assert.equal(situacaoPosicao(pos("A", { sem_contagem: false, itens_contados: 2, recontagens: 1 })), "recontar");
});

test("resumo e plano de encerramento", () => {
  const ps = [
    pos("P1", { itens_faltando: 2 }), // pendente com material
    pos("P2"), // vazia
    pos("P3", { sem_contagem: false, itens_contados: 1, itens_faltando: 1 }), // parcial
    pos("P4", { sem_contagem: false, itens_contados: 3 }), // contada
  ];
  assert.deepEqual(resumoPosicoes(ps), { total: 4, contadas: 1, faltam: 2, recontar: 0, vazias: 1 });
  assert.deepEqual(planoEncerramento(ps), { forcar: true, semContagemComMaterial: 1, parciais: 1, recontagens: 0 });
  assert.equal(planoEncerramento([ps[3]]).forcar, false);
  assert.equal(planoEncerramento([ps[1], ps[3]]).semContagemComMaterial, 0); // só vazia: força sem aviso
});

test("posições agrupadas pelo primeiro nível, em ordem natural", () => {
  const g = agruparPosicoes([{ codigo: "EST01-P01" }, { codigo: "ARM01-GAV01-P10" }, { codigo: "ARM01-GAV01-P02" }]);
  assert.deepEqual(g.map((x) => [x.estrutura, x.posicoes.map((p) => p.codigo)]), [
    ["ARM01", ["ARM01-GAV01-P02", "ARM01-GAV01-P10"]],
    ["EST01", ["EST01-P01"]],
  ]);
});

test("status que recebem contagem e itens que dá para contar", () => {
  assert.equal(recebeContagens("aberta"), true);
  assert.equal(recebeContagens("em_andamento"), true);
  assert.equal(recebeContagens("em_revisao"), false);
  assert.equal(podeContarItem("contar"), true);
  assert.equal(podeContarItem("recontar"), true);
  assert.equal(podeContarItem("contado"), false);
  assert.equal(podeContarItem("recontar_outro"), false);
});

test("preparar contagem: branco fica pendente, 0 vale, vírgula decimal", () => {
  const r = prepararContagem([
    { item_id: "a", unidade: "un", valor: "8" },
    { item_id: "b", unidade: "un", valor: "" },
    { item_id: "c", unidade: "m", valor: "1,5" },
    { item_id: "d", unidade: "un", valor: "0" },
  ]);
  assert.deepEqual(r, {
    ok: true,
    emBranco: 1,
    itens: [
      { item_id: "a", quantidade: 8 },
      { item_id: "c", quantidade: 1.5 },
      { item_id: "d", quantidade: 0 },
    ],
  });
});

test("preparar contagem: erros por item e nada preenchido", () => {
  const r = prepararContagem([
    { item_id: "a", unidade: "un", valor: "2.5" },
    { item_id: "b", unidade: "un", valor: "-1" },
    { item_id: "c", unidade: "un", valor: "abc" },
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.porItem), ["a", "b", "c"]);
  const vazio = prepararContagem([{ item_id: "a", unidade: "un", valor: "  " }]);
  assert.equal(vazio.ok, false);
  assert.match(vazio.geral, /pelo menos um item/);
});

test("linhas atuais = última rodada; ajustes = divergências sem ajuste", () => {
  const l = (endereco_id, item_id, rodada, divergencia, ajuste_movimentacao_id = null) => ({
    endereco_id,
    item_id,
    rodada,
    divergencia,
    ajuste_movimentacao_id,
  });
  const linhas = [l("P1", "x", 1, -2), l("P1", "x", 2, 0), l("P1", "y", 1, 3), l("P2", "x", 1, -1, "mov")];
  assert.deepEqual(
    linhasAtuais(linhas).map((x) => `${x.endereco_id}:${x.item_id}:${x.rodada}`).sort(),
    ["P1:x:2", "P1:y:1", "P2:x:1"],
  );
  assert.deepEqual(ajustesPrevistos(linhas).map((x) => `${x.endereco_id}:${x.item_id}`), ["P1:y"]);
});

test("código lido: normaliza e reconhece etiqueta antiga (troca de QR)", () => {
  const lista = [
    { id: "1", codigo: "ARM01-GAV01-P01", ativo: false, substituido_por_id: "2" },
    { id: "2", codigo: "ARM02-GAV01-P01", ativo: false, substituido_por_id: "3" },
    { id: "3", codigo: "ARM03-GAV01-P01", ativo: true, substituido_por_id: null },
    { id: "4", codigo: "ARM01-GAV01-P02", ativo: true, substituido_por_id: null },
    { id: "5", codigo: "ARM01-GAV01-P03", ativo: false, substituido_por_id: null },
  ];
  assert.equal(normalizarCodigo(" arm01-gav01-p02 \n"), "ARM01-GAV01-P02");
  assert.deepEqual(resolverEndereco(lista, "  "), { tipo: "vazio" });
  assert.deepEqual(resolverEndereco(lista, "xyz"), { tipo: "nao_encontrado", codigo: "XYZ" });
  assert.equal(resolverEndereco(lista, "arm01-gav01-p02").tipo, "ativo");
  assert.equal(resolverEndereco(lista, "ARM01-GAV01-P03").tipo, "inativo");
  const antiga = resolverEndereco(lista, "ARM01-GAV01-P01");
  assert.equal(antiga.tipo, "substituido");
  assert.equal(antiga.antigo.codigo, "ARM01-GAV01-P01");
  assert.equal(antiga.atual.codigo, "ARM03-GAV01-P01"); // segue a cadeia de trocas até o atual
});

test("código lido: cadeia de trocas com laço não trava", () => {
  const lista = [
    { id: "1", codigo: "A", ativo: false, substituido_por_id: "2" },
    { id: "2", codigo: "B", ativo: false, substituido_por_id: "1" },
  ];
  assert.equal(resolverEndereco(lista, "A").tipo, "substituido");
});
