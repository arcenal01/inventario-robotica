import type { Metadata } from "next";
import { PainelItens } from "@/features/itens/painel-itens";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Itens" };

export default async function PaginaItens() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Itens</h1>
      <PainelItens papel={perfil.perfil} />
    </div>
  );
}
