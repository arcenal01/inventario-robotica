import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorEstrutura, ordenarPorLocal, podeCancelar, podeSeparar, prepararConferencia } from "../src/features/romaneios/regras.ts";

const l = (codigo, nome) => ({ endereco: { codigo }, item: { nome } });

test("separação segue o código do endereço (P02 antes de P10), depois o nome", () => {
  const ordem = ordenarPorLocal([l("ARM01-GAV01-P10", "B"), l("ARM01-GAV01-P02", "Z"), l("ARM01-GAV01-P02", "A"), l("ARM02-GAV01-P01", "C")]);
  assert.deepEqual(ordem.map((x) => `${x.endereco.codigo}:${x.item.nome}`), [
    "ARM01-GAV01-P02:A", "ARM01-GAV01-P02:Z", "ARM01-GAV01-P10:B", "ARM02-GAV01-P01:C",
  ]);
});

test("agrupa pelo primeiro nível do endereço", () => {
  const grupos = agruparPorEstrutura([l("EST01-PRA02-P01", "x"), l("ARM01-GAV01-P01", "y"), l("ARM01-GAV02-P01", "z")]);
  assert.deepEqual(grupos.map((g) => [g.estrutura, g.linhas.length]), [["ARM01", 2], ["EST01", 1]]);
});

test("status: separar só gerado/em separação; cancelar até antes da entrega", () => {
  assert.equal(podeSeparar("gerado"), true);
  assert.equal(podeSeparar("separado"), false);
  assert.equal(podeCancelar("separado"), true);
  assert.equal(podeCancelar("entregue"), false);
  assert.equal(podeCancelar("cancelado"), false);
});

test("conferência: monta o JSON de entregar_romaneio", () => {
  const r = prepararConferencia([
    { id: "a", quantidade: 5, conferida: "5", unidade: "un" },
    { id: "b", quantidade: 2, conferida: "0", unidade: "un" },
    { id: "c", quantidade: 1.5, conferida: "1,5", unidade: "m" },
  ]);
  assert.deepEqual(r, {
    ok: true,
    total: 6.5,
    conferencias: [
      { romaneio_item_id: "a", quantidade_conferida: 5 },
      { romaneio_item_id: "b", quantidade_conferida: 0 },
      { romaneio_item_id: "c", quantidade_conferida: 1.5 },
    ],
  });
});

test("conferência: acima do separado, vazio, 'un' quebrado e nada conferido", () => {
  const r = prepararConferencia([
    { id: "a", quantidade: 5, conferida: "6", unidade: "un" },
    { id: "b", quantidade: 5, conferida: "", unidade: "un" },
    { id: "c", quantidade: 5, conferida: "2.5", unidade: "un" },
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.porLinha), ["a", "b", "c"]);
  const zero = prepararConferencia([{ id: "a", quantidade: 5, conferida: "0", unidade: "un" }]);
  assert.equal(zero.ok, false);
  assert.equal(zero.geral, "Nada conferido para entregar");
});
