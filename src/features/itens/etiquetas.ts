// Seleção dos itens para a folha de etiquetas. Sem dependências de tela: testado em tests/itens.test.mjs.

type ItemEtiquetavel = { id: string; codigo: string; nome: string; categoria_id: string; status: "ativo" | "inativo" };

export type FiltroEtiquetas = {
  /** Códigos escolhidos (ex.: da lista filtrada ou da ficha do item). Mantém a ordem pedida. */
  codigos?: string[];
  /** Todos os itens ativos de uma categoria */
  categoriaId?: string;
  /** Todos os itens ativos */
  todos?: boolean;
};

/**
 * Itens da folha de etiquetas. Por código: imprime mesmo se inativo (foi pedido de propósito).
 * Por categoria ou todos: só ativos, em ordem natural de código (ALI-002 antes de ALI-010).
 */
export function selecionarItensParaEtiquetas<T extends ItemEtiquetavel>(itens: T[], filtro: FiltroEtiquetas): T[] {
  if (filtro.codigos && filtro.codigos.length > 0) {
    const porCodigo = new Map(itens.map((i) => [i.codigo.toUpperCase(), i]));
    const vistos = new Set<string>();
    const escolhidos: T[] = [];
    for (const bruto of filtro.codigos) {
      const codigo = bruto.trim().toUpperCase();
      const item = porCodigo.get(codigo);
      if (item && !vistos.has(codigo)) {
        vistos.add(codigo);
        escolhidos.push(item);
      }
    }
    return escolhidos;
  }
  if (!filtro.categoriaId && !filtro.todos) return [];
  return itens
    .filter((i) => i.status === "ativo" && (!filtro.categoriaId || i.categoria_id === filtro.categoriaId))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}

/** Onde o item está, para a etiqueta: até 2 endereços (o de maior saldo primeiro) e "+N" se houver mais. */
export function textoLocal(saldos: { codigo: string; quantidade_atual: number }[]): string {
  const ordenados = [...saldos]
    .filter((s) => Number(s.quantidade_atual) > 0)
    .sort((a, b) => Number(b.quantidade_atual) - Number(a.quantidade_atual) || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  if (ordenados.length === 0) return "";
  const primeiros = ordenados.slice(0, 2).map((s) => s.codigo).join(", ");
  return ordenados.length > 2 ? `${primeiros} +${ordenados.length - 2}` : primeiros;
}
