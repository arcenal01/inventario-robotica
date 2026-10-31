// CSV para abrir direto no Excel em português. Sem dependências de tela: testado em tests/relatorios.test.mjs.
// Excel pt-BR espera ";" entre colunas, vírgula decimal e BOM UTF-8 (senão os acentos quebram).

export type Coluna<T> = {
  titulo: string;
  valor: (linha: T) => string | number | null | undefined;
  /** Alinha à direita na tabela (números). */
  numero?: boolean;
};

function celula(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const texto = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function gerarCsv<T>(colunas: Coluna<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
  return "﻿" + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}

/** Ex.: "estoque-por-endereco-2026-10-31.csv" */
export function nomeArquivo(base: string, dia: string): string {
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${limpo}-${dia}.csv`;
}
