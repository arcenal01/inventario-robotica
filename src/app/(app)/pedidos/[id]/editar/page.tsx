import type { Metadata } from "next";
import Link from "next/link";
import { EditarPedido } from "@/features/pedidos/editar-pedido";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Editar pedido" };

export default async function PaginaEditarPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <Link href={`/pedidos/${id}`} className="text-sm text-primary hover:underline">
        Voltar para o pedido
      </Link>
      <h1 className="text-2xl font-semibold">Editar rascunho</h1>
      <EditarPedido id={id} usuarioId={perfil.id} />
    </div>
  );
}
