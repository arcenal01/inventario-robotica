import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesDoPedido, prepararItens, quantidadesAlteradas, visivelNaLista } from "../src/features/pedidos/regras.ts";
import { destinoNotificacao } from "../src/features/notificacoes/destino.ts";

test("ações do dono (aluno)", () => {
  assert.deepEqual(acoesDoPedido("rascunho", false, true), ["editar", "enviar", "cancelar"]);
  assert.deepEqual(acoesDoPedido("enviado", false, true), ["cancelar"]);
  assert.deepEqual(acoesDoPedido("aprovado", false, true), []);
  assert.deepEqual(acoesDoPedido("enviado", false, false), []);
});

test("ações da equipe seguem o status", () => {
  assert.deepEqual(acoesDoPedido("enviado", true, false), ["aprovar", "rejeitar", "cancelar"]);
  assert.deepEqual(acoesDoPedido("aprovado", true, false), ["gerar_romaneio", "cancelar"]);
  assert.deepEqual(acoesDoPedido("separado", true, false), ["cancelar"]);
  assert.deepEqual(acoesDoPedido("entregue", true, false), ["concluir"]);
  for (const s of ["rejeitado", "concluido", "cancelado"]) assert.deepEqual(acoesDoPedido(s, true, true), []);
});

test("rascunho alheio não aparece na lista da equipe", () => {
  assert.equal(visivelNaLista({ status: "rascunho", solicitante_id: "a" }, "b"), false);
  assert.equal(visivelNaLista({ status: "rascunho", solicitante_id: "a" }, "a"), true);
  assert.equal(visivelNaLista({ status: "enviado", solicitante_id: "a" }, "b"), true);
});

const linha = (id, quantidade, unidade = "un", observacao = "") => ({ item_id: id, codigo: id, unidade, quantidade, observacao });

test("carrinho: monta o JSON da função salvar_pedido", () => {
  const r = prepararItens([linha("a", "2", "un", "  para o robô "), linha("b", "1,5", "m")]);
  assert.deepEqual(r, { ok: true, itens: [
    { item_id: "a", quantidade: 2, observacao: "para o robô" },
    { item_id: "b", quantidade: 1.5, observacao: null },
  ] });
});

test("carrinho: vazio, quantidade inválida e 'un' quebrado", () => {
  assert.equal(prepararItens([]).geral, "Adicione pelo menos um item");
  const r = prepararItens([linha("a", "0"), linha("b", ""), linha("c", "2.5"), linha("d", "3", "kg")]);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.porLinha).sort(), ["a", "b", "c"]);
});

test("aprovação: só manda o que mudou; 0 é aceito (tira o item)", () => {
  const r = quantidadesAlteradas([
    { pedido_item_id: "1", solicitada: 5, aprovada: "5", unidade: "un" },
    { pedido_item_id: "2", solicitada: 3, aprovada: "1", unidade: "un" },
    { pedido_item_id: "3", solicitada: 2, aprovada: "0", unidade: "un" },
  ]);
  assert.deepEqual(r, { ok: true, lista: [{ pedido_item_id: "2", quantidade: 1 }, { pedido_item_id: "3", quantidade: 0 }] });
  assert.equal(quantidadesAlteradas([{ pedido_item_id: "1", solicitada: 5, aprovada: "-1", unidade: "un" }]).ok, false);
  assert.equal(quantidadesAlteradas([{ pedido_item_id: "1", solicitada: 5, aprovada: "1.5", unidade: "un" }]).ok, false);
});

test("notificação leva para a tela certa", () => {
  assert.equal(destinoNotificacao({ referencia_tabela: "pedidos", referencia_id: "x" }), "/pedidos/x");
  assert.equal(destinoNotificacao({ referencia_tabela: "trocas_qr", referencia_id: "y" }), "/enderecos/trocas");
  assert.equal(destinoNotificacao({ referencia_tabela: null, referencia_id: null }), null);
});
