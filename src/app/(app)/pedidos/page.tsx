import type { Metadata } from "next";
import { ListaPedidos } from "@/features/pedidos/lista-pedidos";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PaginaPedidos() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{perfil.perfil === "aluno" ? "Meus pedidos" : "Pedidos"}</h1>
      <ListaPedidos usuarioId={perfil.id} equipe={perfil.perfil !== "aluno"} />
    </div>
  );
}
