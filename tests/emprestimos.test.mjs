import { test } from "node:test";
import assert from "node:assert/strict";
import { novaChave } from "../src/lib/chave.ts";
import { diasDeAtraso, formatarData, hojeBrasilia, inicioDeDiasAtras } from "../src/lib/datas.ts";
import { traduzirErroBanco } from "../src/lib/erros.ts";
import { filtrarEmprestimos, ordenarAbertos, situacaoEmprestimo } from "../src/features/emprestimos/situacao.ts";
import { quantidadeValida } from "../src/features/estoque/schemas.ts";

test("hoje em Brasília: 02h UTC ainda é o dia anterior", () => {
  assert.equal(hojeBrasilia(new Date("2026-11-01T02:00:00Z")), "2026-10-31");
  assert.equal(hojeBrasilia(new Date("2026-11-01T04:00:00Z")), "2026-11-01");
});

test("atraso conta dias depois do prazo; sem prazo ou no dia não atrasa", () => {
  assert.equal(diasDeAtraso("2026-10-28", "2026-10-31"), 3);
  assert.equal(diasDeAtraso("2026-10-31", "2026-10-31"), 0);
  assert.equal(diasDeAtraso(null, "2026-10-31"), 0);
  assert.equal(diasDeAtraso("2026-02-27", "2026-03-01"), 2);
});

test("datas formatadas e início do período", () => {
  assert.equal(formatarData("2026-10-31"), "31/10/2026");
  assert.equal(formatarData(null), "");
  assert.equal(inicioDeDiasAtras(7, new Date("2026-10-31T15:00:00Z")), "2026-10-24T00:00:00-03:00");
});

test("chave de idempotência é UUID v4 e não se repete", () => {
  const chaves = new Set(Array.from({ length: 500 }, novaChave));
  assert.equal(chaves.size, 500);
  for (const c of chaves) assert.match(c, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("chave funciona sem randomUUID (celular em http://IP)", () => {
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    assert.match(novaChave(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
  }
});

const HOJE = "2026-10-31";
const emp = (id, prazo, pessoa, item, em = "2026-10-01T10:00:00Z") => ({
  id, prazo_previsto: prazo, emprestado_em: em,
  item: { codigo: item, nome: `Item ${item}` }, pessoa: { nome: pessoa, turma: "2º A" },
});
const lista = [
  emp("sem-prazo", null, "Ana Souza", "FER-001"),
  emp("vence-depois", "2026-11-10", "Bruno Lima", "FER-002"),
  emp("atrasado-1", "2026-10-30", "Carla Dias", "PLA-001"),
  emp("atrasado-5", "2026-10-26", "Júlia Melo", "PLA-002"),
  emp("vence-antes", "2026-11-02", "Ana Souza", "CAB-001"),
];

test("situação e ordem: atrasados primeiro, depois prazo mais próximo, sem prazo por último", () => {
  assert.deepEqual(situacaoEmprestimo(lista[3], HOJE), { atrasado: true, dias: 5 });
  assert.deepEqual(situacaoEmprestimo(lista[0], HOJE), { atrasado: false, dias: 0 });
  assert.deepEqual(
    ordenarAbertos(lista, HOJE).map((e) => e.id),
    ["atrasado-5", "atrasado-1", "vence-antes", "vence-depois", "sem-prazo"],
  );
});

test("busca por pessoa (sem acento), item e só atrasados", () => {
  assert.deepEqual(filtrarEmprestimos(lista, "julia", false, HOJE).map((e) => e.id), ["atrasado-5"]);
  assert.deepEqual(filtrarEmprestimos(lista, "ana cab", false, HOJE).map((e) => e.id), ["vence-antes"]);
  assert.equal(filtrarEmprestimos(lista, "", true, HOJE).length, 2);
});

test("quantidade em 'un' só inteira; erros do banco traduzidos", () => {
  assert.equal(quantidadeValida(2, "un"), null);
  assert.match(quantidadeValida(2.5, "un"), /inteiro/);
  assert.equal(quantidadeValida(2.5, "m"), null);
  assert.match(traduzirErroBanco("TypeError: Failed to fetch"), /Sem conexão/);
  assert.equal(traduzirErroBanco("Saldo insuficiente no endereço."), "Saldo insuficiente no endereço.");
});
