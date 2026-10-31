import type { Metadata } from "next";
import Link from "next/link";
import { DetalhePedido } from "@/features/pedidos/detalhe-pedido";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Pedido" };

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <Link href="/pedidos" className="text-sm text-primary hover:underline">
        Voltar para pedidos
      </Link>
      <DetalhePedido id={id} usuarioId={perfil.id} equipe={perfil.perfil !== "aluno"} />
    </div>
  );
}
