import type { Metadata } from "next";
import Link from "next/link";
import { PainelCategorias } from "@/features/itens/painel-categorias";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Categorias" };

export default async function PaginaCategorias() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href="/itens" className="text-sm text-primary hover:underline">
        Voltar para itens
      </Link>
      <h1 className="text-2xl font-semibold">Categorias</h1>
      <PainelCategorias />
    </div>
  );
}
