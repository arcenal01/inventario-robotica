"use client";

import { usePedido } from "./consultas";
import { FormularioPedido } from "./formulario-pedido";

/** Carrega o rascunho e abre o formulário (só o dono edita, e só em rascunho: o banco confere). */
export function EditarPedido({ id, usuarioId }: { id: string; usuarioId: string }) {
  const pedidoQ = usePedido(id);
  if (pedidoQ.isPending) return <p className="text-sm text-muted-foreground">Carregando pedido...</p>;
  if (pedidoQ.isError) return <p className="text-sm text-red-800">Erro: {pedidoQ.error.message}</p>;
  const pedido = pedidoQ.data;
  if (!pedido || pedido.solicitante_id !== usuarioId || pedido.status !== "rascunho") {
    return <p className="text-sm text-muted-foreground">Só o autor edita, e só enquanto o pedido é rascunho.</p>;
  }
  return <FormularioPedido pedido={pedido} turmaPadrao={null} />;
}
