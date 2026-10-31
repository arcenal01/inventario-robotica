import type { Metadata } from "next";
import { PainelMovimentacoes } from "@/features/estoque/painel-movimentacoes";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Movimentações" };

export default async function PaginaMovimentacoes() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <PainelMovimentacoes />
    </div>
  );
}
