// Regras dos pedidos que a tela usa (quais botões aparecem, abas, validação do carrinho).
// Sem dependências de tela: testadas em tests/pedidos.test.mjs. O banco confere tudo de novo.

export type StatusPedido =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "rejeitado"
  | "separado"
  | "entregue"
  | "concluido"
  | "cancelado";

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  rascunho: "Rascunho",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  separado: "Separado",
  entregue: "Entregue",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const COR_STATUS_PEDIDO: Record<StatusPedido, "default" | "success" | "warning" | "danger"> = {
  rascunho: "default",
  enviado: "warning",
  aprovado: "success",
  rejeitado: "danger",
  separado: "success",
  entregue: "success",
  concluido: "default",
  cancelado: "danger",
};

export const ENCERRADOS: StatusPedido[] = ["rejeitado", "concluido", "cancelado"];

export type Acao = "editar" | "enviar" | "cancelar" | "aprovar" | "rejeitar" | "gerar_romaneio" | "concluir";

/** Botões disponíveis para quem está vendo o pedido (espelha as regras das funções do banco). */
export function acoesDoPedido(status: StatusPedido, equipe: boolean, dono: boolean): Acao[] {
  const acoes: Acao[] = [];
  if (dono && status === "rascunho") acoes.push("editar", "enviar");
  if (equipe && status === "enviado") acoes.push("aprovar", "rejeitar");
  if (equipe && status === "aprovado") acoes.push("gerar_romaneio");
  if (equipe && status === "entregue") acoes.push("concluir");
  const podeCancelar =
    (dono && (status === "rascunho" || status === "enviado")) ||
    (equipe && ["rascunho", "enviado", "aprovado", "separado"].includes(status));
  if (podeCancelar) acoes.push("cancelar");
  return acoes;
}

/** Rascunho é particular: na lista da equipe só aparecem os próprios rascunhos. */
export function visivelNaLista(p: { status: StatusPedido; solicitante_id: string }, usuarioId: string): boolean {
  return p.status !== "rascunho" || p.solicitante_id === usuarioId;
}

export type LinhaCarrinho = { item_id: string; codigo: string; unidade: string; quantidade: string; observacao: string };

/** Valida o carrinho e devolve o JSON que a função salvar_pedido espera (ou a lista de erros por linha). */
export function prepararItens(linhas: LinhaCarrinho[]):
  | { ok: true; itens: { item_id: string; quantidade: number; observacao: string | null }[] }
  | { ok: false; geral?: string; porLinha: Record<string, string> } {
  if (linhas.length === 0) return { ok: false, geral: "Adicione pelo menos um item", porLinha: {} };
  const porLinha: Record<string, string> = {};
  const vistos = new Set<string>();
  const itens = linhas.map((l) => {
    const n = Number(l.quantidade.replace(",", "."));
    if (vistos.has(l.item_id)) porLinha[l.item_id] = "Item repetido";
    vistos.add(l.item_id);
    if (!l.quantidade.trim() || !Number.isFinite(n) || n <= 0) porLinha[l.item_id] = "Quantidade maior que zero";
    else if (l.unidade === "un" && !Number.isInteger(n)) porLinha[l.item_id] = 'Em "un" use número inteiro';
    else if (n > 999999) porLinha[l.item_id] = "Número muito grande";
    if (l.observacao.trim().length > 120) porLinha[l.item_id] = "Observação: máximo 120 caracteres";
    return { item_id: l.item_id, quantidade: n, observacao: l.observacao.trim() || null };
  });
  return Object.keys(porLinha).length > 0 ? { ok: false, porLinha } : { ok: true, itens };
}

/** Quantidades aprovadas que mudaram (o banco aprova o solicitado quando não vem nada). 0 = item removido. */
export function quantidadesAlteradas(
  linhas: { pedido_item_id: string; solicitada: number; aprovada: string; unidade: string }[],
): { ok: true; lista: { pedido_item_id: string; quantidade: number }[] } | { ok: false; porLinha: Record<string, string> } {
  const porLinha: Record<string, string> = {};
  const lista: { pedido_item_id: string; quantidade: number }[] = [];
  for (const l of linhas) {
    const n = Number(l.aprovada.replace(",", "."));
    if (!l.aprovada.trim() || !Number.isFinite(n) || n < 0) porLinha[l.pedido_item_id] = "Informe 0 ou mais";
    else if (l.unidade === "un" && !Number.isInteger(n)) porLinha[l.pedido_item_id] = 'Em "un" use número inteiro';
    else if (n !== l.solicitada) lista.push({ pedido_item_id: l.pedido_item_id, quantidade: n });
  }
  if (Object.keys(porLinha).length > 0) return { ok: false, porLinha };
  return { ok: true, lista };
}
