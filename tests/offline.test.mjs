import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveGuardar,
  dicaRecusa,
  descreverAtualizacao,
  eFalhaTemporaria,
  itensNaFila,
  resumoFila,
  textoDaChave,
} from "../src/features/offline/regras.ts";

const envio = (campos = {}) => ({
  chave: "k1",
  tipo: "contagem",
  contagemId: "c1",
  contagemCodigo: "CNT-2026-0001",
  enderecoId: "e1",
  enderecoCodigo: "ARM01-P01",
  itens: [{ item_id: "i1", quantidade: 2 }],
  criadoEm: 1,
  estado: "pendente",
  motivo: null,
  tentativas: 0,
  ...campos,
});

test("guarda no aparelho só itens, categorias, endereços, saldos e contagens", () => {
  for (const k of [["itens"], ["categorias"], ["enderecos"], ["tipos_endereco"], ["saldos", "x"], ["contagens", "c1", "itens", "e1"]]) {
    assert.equal(deveGuardar(k), true, JSON.stringify(k));
  }
  for (const k of [["pedidos"], ["movimentacoes"], ["notificacoes", "nao_lidas"], ["relatorio", "estoque"], [42]]) {
    assert.equal(deveGuardar(k), false, JSON.stringify(k));
  }
});

test("chave da consulta vira texto estável", () => {
  assert.equal(textoDaChave(["contagens", "c1", "itens", null]), '["contagens","c1","itens",null]');
});

test("falha temporária (tenta de novo) x recusa do banco (vai para recusados)", () => {
  assert.equal(eFalhaTemporaria(0, "TypeError: Failed to fetch"), true);
  assert.equal(eFalhaTemporaria(undefined, ""), true);
  assert.equal(eFalhaTemporaria(502, "Bad Gateway"), true);
  assert.equal(eFalhaTemporaria(500, "erro interno"), true);
  assert.equal(eFalhaTemporaria(401, "JWT expired"), true);
  assert.equal(eFalhaTemporaria(429, "muitas"), true);
  assert.equal(eFalhaTemporaria(200, "Load failed"), true); // Safari sem rede
  assert.equal(eFalhaTemporaria(400, "Esta contagem não está recebendo contagens (status: em_revisao)."), false);
  assert.equal(eFalhaTemporaria(403, "permission denied"), false);
  assert.equal(eFalhaTemporaria(404, "Could not find the function"), false);
});

test("resumo da fila: pendentes e recusados", () => {
  assert.deepEqual(resumoFila([]), { pendentes: 0, recusados: 0 });
  assert.deepEqual(resumoFila([envio(), envio({ chave: "k2" }), envio({ chave: "k3", estado: "recusado" })]), { pendentes: 2, recusados: 1 });
});

test("itens na fila: só os pendentes da mesma contagem e posição", () => {
  const fila = [
    envio({ itens: [{ item_id: "i1", quantidade: 1 }, { item_id: "i2", quantidade: 0 }] }),
    envio({ chave: "k2", enderecoId: "e2", itens: [{ item_id: "i3", quantidade: 1 }] }),
    envio({ chave: "k3", contagemId: "c2", itens: [{ item_id: "i4", quantidade: 1 }] }),
    envio({ chave: "k4", estado: "recusado", itens: [{ item_id: "i5", quantidade: 1 }] }),
  ];
  assert.deepEqual([...itensNaFila(fila, "c1", "e1")].sort(), ["i1", "i2"]);
  assert.deepEqual([...itensNaFila(fila, "c1", "e2")], ["i3"]);
  assert.equal(itensNaFila(fila, "c1", null).size, 0);
});

test("descrição de quando os dados foram guardados", () => {
  const agora = new Date(2026, 10, 1, 15, 0).getTime();
  assert.match(descreverAtualizacao(new Date(2026, 10, 1, 9, 5).getTime(), agora), /^hoje às 09:05$/);
  assert.match(descreverAtualizacao(new Date(2026, 9, 30, 18, 40).getTime(), agora), /^30\/10\/2026 às 18:40$/);
});

test("dica da recusa: o que dá para corrigir e o que só dá para descartar", () => {
  const encerrada = dicaRecusa("Esta contagem não está recebendo contagens (status: em_revisao).");
  assert.equal(encerrada.podeCorrigir, false);
  assert.match(encerrada.texto, /encerrada ou cancelada/);
  assert.equal(dicaRecusa("Contagem não encontrada.").podeCorrigir, false);
  assert.equal(dicaRecusa("Este endereço não faz parte desta contagem.").podeCorrigir, false);
  assert.equal(dicaRecusa("Sem permissão.").podeCorrigir, false);

  const contado = dicaRecusa("O item SEN-002 já foi contado neste endereço.");
  assert.equal(contado.podeCorrigir, true);
  assert.equal(contado.codigoItem, "SEN-002");
  assert.match(contado.texto, /Tire o item/);
  assert.equal(dicaRecusa("A recontagem de MOT-1000 deve ser feita por outra pessoa.").codigoItem, "MOT-1000");
  assert.equal(dicaRecusa("O item ARD-007 não pertence à categoria desta contagem.").podeCorrigir, true);

  const outra = dicaRecusa("Itens em unidade \"un\" aceitam apenas quantidade inteira.");
  assert.equal(outra.podeCorrigir, true);
  assert.equal(outra.codigoItem, null);
  assert.equal(dicaRecusa(null).podeCorrigir, true);
});
