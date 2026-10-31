import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarCsv, nomeArquivo } from "../src/features/relatorios/csv.ts";
import {
  contemTudo,
  diasAntes,
  eTipoRelatorio,
  filtrarEmprestimosRelatorio,
  intervaloBrasilia,
  situacaoRelatorio,
  somar,
} from "../src/features/relatorios/regras.ts";

test("CSV para Excel pt-BR: BOM, ponto e vírgula, vírgula decimal e aspas", () => {
  const csv = gerarCsv(
    [
      { titulo: "Item", valor: (l) => l.nome },
      { titulo: "Qtd", valor: (l) => l.q },
      { titulo: "Obs", valor: (l) => l.obs },
    ],
    [
      { nome: "Estanho", q: 1.5, obs: null },
      { nome: 'Cabo "USB"; A-B', q: 8, obs: "linha1\nlinha2" },
    ],
  );
  assert.equal(csv, '﻿Item;Qtd;Obs\r\nEstanho;1,5;\r\n"Cabo ""USB""; A-B";8;"linha1\nlinha2"\r\n');
});

test("nome do arquivo sem acento nem espaço", () => {
  assert.equal(nomeArquivo("Estoque por endereço", "2026-10-31"), "estoque-por-endereco-2026-10-31.csv");
  assert.equal(nomeArquivo("Divergências de contagem", "2026-01-02"), "divergencias-de-contagem-2026-01-02.csv");
});

test("período em Brasília e datas", () => {
  assert.deepEqual(intervaloBrasilia("2026-10-01", "2026-10-31"), {
    inicio: "2026-10-01T00:00:00-03:00",
    fim: "2026-10-31T23:59:59.999-03:00",
  });
  assert.equal(intervaloBrasilia("2026-11-01", "2026-10-31"), null);
  assert.equal(intervaloBrasilia("", "2026-10-31"), null);
  assert.equal(diasAntes("2026-03-01", 1), "2026-02-28");
  assert.equal(diasAntes("2026-10-31", 30), "2026-10-01");
});

test("tipos de relatório válidos", () => {
  assert.equal(eTipoRelatorio("estoque"), true);
  assert.equal(eTipoRelatorio("divergencias"), true);
  assert.equal(eTipoRelatorio("senhas"), false);
});

test("empréstimos: filtros e situação", () => {
  const hoje = "2026-10-31";
  const e = (status, prazo, perdida = 0) => ({ status, prazo_previsto: prazo, quantidade_perdida: perdida });
  const lista = [e("em_aberto", "2026-10-20"), e("em_aberto", null), e("devolvido_parcial", "2026-11-05", 1), e("perdido", null, 2), e("devolvido", null)];
  assert.equal(filtrarEmprestimosRelatorio(lista, "abertos", hoje).length, 3);
  assert.equal(filtrarEmprestimosRelatorio(lista, "atrasados", hoje).length, 1);
  assert.equal(filtrarEmprestimosRelatorio(lista, "perdidos", hoje).length, 2);
  assert.equal(filtrarEmprestimosRelatorio(lista, "todos", hoje).length, 5);
  assert.equal(situacaoRelatorio(lista[0], hoje), "Atrasado 11 dia(s)");
  assert.equal(situacaoRelatorio(lista[1], hoje), "Em aberto");
  assert.equal(situacaoRelatorio(lista[2], hoje), "Devolvido em parte");
  assert.equal(situacaoRelatorio(lista[3], hoje), "Perdido");
});

test("busca e soma", () => {
  assert.equal(contemTudo("ARM01-GAV01-P01 Arduino Uno", "arduino arm01"), true);
  assert.equal(contemTudo("Sensor ultrassônico", "ultrassonico"), true);
  assert.equal(contemTudo("Sensor", "motor"), false);
  assert.equal(somar([{ q: 0.1 }, { q: 0.2 }], (l) => l.q), 0.3);
});
