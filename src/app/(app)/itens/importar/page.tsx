import type { Metadata } from "next";
import Link from "next/link";
import { ImportarPlanilha } from "@/features/itens/importar-planilha";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Importar planilha" };

export default async function PaginaImportarItens() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href="/itens" className="text-sm text-primary hover:underline">
        Voltar para itens
      </Link>
      <h1 className="text-2xl font-semibold">Importar planilha de coleta</h1>
      <ImportarPlanilha />
    </div>
  );
}
