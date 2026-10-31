import type { Metadata } from "next";
import Link from "next/link";
import { FormularioPedido } from "@/features/pedidos/formulario-pedido";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function PaginaNovoPedido() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <Link href="/pedidos" className="text-sm text-primary hover:underline">
        Voltar para pedidos
      </Link>
      <h1 className="text-2xl font-semibold">Novo pedido</h1>
      <FormularioPedido pedido={null} turmaPadrao={perfil.turma} />
    </div>
  );
}
