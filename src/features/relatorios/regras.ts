// Regras dos relatórios e do painel. Sem dependências de tela: testadas em tests/relatorios.test.mjs.
import { diasDeAtraso } from "../../lib/datas.ts";
import { normalizar } from "../itens/filtros.ts";

export const TIPOS_RELATORIO = ["estoque", "movimentacoes", "emprestimos", "divergencias"] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];

export const INFO_RELATORIO: Record<TipoRelatorio, { titulo: string; descricao: string }> = {
  estoque: { titulo: "Estoque por endereço", descricao: "O que está guardado em cada posição, com quantidade." },
  movimentacoes: { titulo: "Movimentações por período", descricao: "Entradas, saídas, transferências, ajustes, empréstimos e devoluções." },
  emprestimos: { titulo: "Empréstimos", descricao: "Em aberto, atrasados e perdidos, com quem está cada material." },
  divergencias: { titulo: "Divergências de contagem", descricao: "Diferenças entre o sistema e o que foi contado." },
};

export function eTipoRelatorio(valor: string): valor is TipoRelatorio {
  return (TIPOS_RELATORIO as readonly string[]).includes(valor);
}

/** Período em Brasília: do início do dia "de" ao fim do dia "ate" (datas AAAA-MM-DD). */
export function intervaloBrasilia(de: string, ate: string): { inicio: string; fim: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) return null;
  return { inicio: `${de}T00:00:00-03:00`, fim: `${ate}T23:59:59.999-03:00` };
}

/** Data AAAA-MM-DD "n" dias antes de "dia" (contas em UTC para não sofrer com horário de verão). */
export function diasAntes(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Busca simples: todas as palavras precisam aparecer no texto (sem acento, sem maiúsculas). */
export function contemTudo(texto: string, busca: string): boolean {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  const alvo = normalizar(texto);
  return palavras.every((p) => alvo.includes(p));
}

export type SituacaoFiltro = "abertos" | "atrasados" | "perdidos" | "todos";

type EmprestimoRelatorio = {
  status: string;
  prazo_previsto: string | null;
  quantidade_perdida: number;
};

/** Situação de um empréstimo para o relatório. */
export function situacaoRelatorio(e: EmprestimoRelatorio, hoje: string): string {
  if (e.status === "devolvido") return "Devolvido";
  if (e.status === "perdido") return "Perdido";
  const dias = diasDeAtraso(e.prazo_previsto, hoje);
  if (dias > 0) return `Atrasado ${dias} dia(s)`;
  return e.status === "devolvido_parcial" ? "Devolvido em parte" : "Em aberto";
}

export function filtrarEmprestimosRelatorio<T extends EmprestimoRelatorio>(lista: T[], filtro: SituacaoFiltro, hoje: string): T[] {
  const aberto = (e: T) => e.status === "em_aberto" || e.status === "devolvido_parcial";
  if (filtro === "abertos") return lista.filter(aberto);
  if (filtro === "atrasados") return lista.filter((e) => aberto(e) && diasDeAtraso(e.prazo_previsto, hoje) > 0);
  if (filtro === "perdidos") return lista.filter((e) => e.status === "perdido" || e.quantidade_perdida > 0);
  return lista;
}

/** Soma de uma coluna numérica (para o rodapé dos relatórios). */
export function somar<T>(linhas: T[], valor: (l: T) => number): number {
  return Math.round(linhas.reduce((s, l) => s + valor(l), 0) * 1000) / 1000;
}
