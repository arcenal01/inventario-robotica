import type { Metadata } from "next";
import { PainelEnderecos } from "@/features/enderecos/painel-enderecos";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Endereços" };

export default async function PaginaEnderecos() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Endereços</h1>
      <PainelEnderecos papel={perfil.perfil} />
    </div>
  );
}
