// Filtro da lista de itens. Sem dependências de tela: roda no navegador e nos testes (node --test).

export type ItemFiltravel = {
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria_id: string;
  tipo_controle: "consumivel" | "emprestavel";
  status: "ativo" | "inativo";
  abaixo_minimo: boolean;
};

export type Filtros = {
  busca: string;
  categoriaId: string; // "" = todas
  tipoControle: "" | "consumivel" | "emprestavel";
  status: "" | "ativo" | "inativo";
  soAbaixoMinimo: boolean;
};

export const FILTROS_INICIAIS: Filtros = {
  busca: "",
  categoriaId: "",
  tipoControle: "",
  status: "ativo",
  soAbaixoMinimo: false,
};

/** Minúsculas e sem acento: "Motor Elétrico" e "motor eletrico" ficam iguais. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Busca por código, nome ou descrição; todas as palavras digitadas precisam aparecer. */
export function filtrarItens<T extends ItemFiltravel>(itens: T[], filtros: Filtros): T[] {
  const palavras = normalizar(filtros.busca).split(/\s+/).filter(Boolean);

  return itens.filter((item) => {
    if (filtros.categoriaId && item.categoria_id !== filtros.categoriaId) return false;
    if (filtros.tipoControle && item.tipo_controle !== filtros.tipoControle) return false;
    if (filtros.status && item.status !== filtros.status) return false;
    if (filtros.soAbaixoMinimo && !item.abaixo_minimo) return false;
    if (palavras.length === 0) return true;
    const alvo = normalizar(`${item.codigo} ${item.nome} ${item.descricao ?? ""}`);
    return palavras.every((p) => alvo.includes(p));
  });
}

/** Ordem da lista: abaixo do mínimo primeiro, depois por nome. */
export function ordenarItens<T extends ItemFiltravel>(itens: T[]): T[] {
  return [...itens].sort(
    (a, b) => Number(b.abaixo_minimo) - Number(a.abaixo_minimo) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Quantidade sem zeros inúteis: 7.000 -> "7"; 2.500 -> "2,5". */
export function formatarQuantidade(valor: number | string): string {
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
