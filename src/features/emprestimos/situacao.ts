// Regras de exibição dos empréstimos. Sem dependências de tela: testadas em tests/emprestimos.test.mjs.
import { diasDeAtraso } from "../../lib/datas.ts";
import { normalizar } from "../itens/filtros.ts";

type EmprestimoBase = {
  prazo_previsto: string | null;
  emprestado_em: string;
  item: { codigo: string; nome: string };
  pessoa: { nome: string; turma: string | null } | null;
};

/** Atrasado = tem prazo e o prazo já passou (no horário de Brasília). Sem prazo nunca atrasa. */
export function situacaoEmprestimo(e: { prazo_previsto: string | null }, hoje: string) {
  const dias = diasDeAtraso(e.prazo_previsto, hoje);
  return { atrasado: dias > 0, dias };
}

/** Busca por pessoa, turma, código ou nome do item; todas as palavras precisam aparecer. */
export function filtrarEmprestimos<T extends EmprestimoBase>(lista: T[], busca: string, soAtrasados: boolean, hoje: string): T[] {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  return lista.filter((e) => {
    if (soAtrasados && !situacaoEmprestimo(e, hoje).atrasado) return false;
    if (palavras.length === 0) return true;
    const alvo = normalizar(`${e.pessoa?.nome ?? ""} ${e.pessoa?.turma ?? ""} ${e.item.codigo} ${e.item.nome}`);
    return palavras.every((p) => alvo.includes(p));
  });
}

/** Em aberto: atrasados primeiro (mais dias antes), depois prazo mais próximo, sem prazo por último. */
export function ordenarAbertos<T extends EmprestimoBase>(lista: T[], hoje: string): T[] {
  return [...lista].sort((a, b) => {
    const da = situacaoEmprestimo(a, hoje).dias;
    const db = situacaoEmprestimo(b, hoje).dias;
    if (da !== db) return db - da;
    if (a.prazo_previsto && b.prazo_previsto && a.prazo_previsto !== b.prazo_previsto) {
      return a.prazo_previsto.localeCompare(b.prazo_previsto);
    }
    if (Boolean(a.prazo_previsto) !== Boolean(b.prazo_previsto)) return a.prazo_previsto ? -1 : 1;
    return a.emprestado_em.localeCompare(b.emprestado_em);
  });
}
