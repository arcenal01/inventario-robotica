import type { Tables } from "@/types/database";

export type Endereco = Tables<"enderecos">;
export type TipoEndereco = Tables<"tipos_endereco">;
export type NoArvore = Endereco & { filhos: NoArvore[] };

/** Ordena por código de forma "natural": TEP2 vem antes de TEP10. */
export function compararCodigos(a: { codigo: string }, b: { codigo: string }) {
  return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });
}

/** Transforma a lista plana de endereços em árvore (pai -> filhos), ordenada por código. */
export function montarArvore(lista: Endereco[]): NoArvore[] {
  const porId = new Map<string, NoArvore>();
  for (const e of lista) porId.set(e.id, { ...e, filhos: [] });

  const raizes: NoArvore[] = [];
  for (const no of porId.values()) {
    const pai = no.pai_id ? porId.get(no.pai_id) : undefined;
    if (pai) pai.filhos.push(no);
    else raizes.push(no);
  }

  const ordenar = (nos: NoArvore[]) => {
    nos.sort(compararCodigos);
    nos.forEach((n) => ordenar(n.filhos));
  };
  ordenar(raizes);
  return raizes;
}

/** IDs do endereço e de tudo que está dentro dele (em qualquer nível). */
export function idsComDescendentes(lista: Endereco[], id: string): Set<string> {
  const filhosDe = new Map<string, string[]>();
  for (const e of lista) {
    if (!e.pai_id) continue;
    const irmaos = filhosDe.get(e.pai_id);
    if (irmaos) irmaos.push(e.id);
    else filhosDe.set(e.pai_id, [e.id]);
  }

  const resultado = new Set<string>();
  const pilha = [id];
  while (pilha.length > 0) {
    const atual = pilha.pop() as string;
    if (resultado.has(atual)) continue;
    resultado.add(atual);
    pilha.push(...(filhosDe.get(atual) ?? []));
  }
  return resultado;
}

export type PedidoEtiquetas = {
  ids?: string[];
  raiz?: string;
  todos?: boolean;
  /** Endereços novos de uma troca de QR (já resolvidos pela página). */
  novosIds?: string[];
};

/** Escolhe quais endereços entram na folha de etiquetas. Só endereços ativos (os substituídos não se imprimem). */
export function selecionarParaEtiquetas(lista: Endereco[], pedido: PedidoEtiquetas): Endereco[] {
  let escolhidos: Set<string>;
  if (pedido.todos) {
    escolhidos = new Set(lista.map((e) => e.id));
  } else if (pedido.raiz) {
    escolhidos = idsComDescendentes(lista, pedido.raiz);
  } else {
    escolhidos = new Set([...(pedido.ids ?? []), ...(pedido.novosIds ?? [])]);
  }
  return lista.filter((e) => escolhidos.has(e.id) && e.ativo).sort(compararCodigos);
}
