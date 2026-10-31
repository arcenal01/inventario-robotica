import type { Metadata } from "next";
import { ListaContagens } from "@/features/contagens/lista-contagens";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Contagens" };

export default async function PaginaContagens() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contagens de estoque</h1>
      <ListaContagens equipe={perfil.perfil !== "aluno"} />
    </div>
  );
}
