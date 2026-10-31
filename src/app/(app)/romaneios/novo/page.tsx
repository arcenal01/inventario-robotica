import type { Metadata } from "next";
import Link from "next/link";
import { FormularioAvulso } from "@/features/romaneios/formulario-avulso";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Novo romaneio" };

export default async function PaginaNovoRomaneio() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href="/romaneios" className="text-sm text-primary hover:underline">
        Voltar para romaneios
      </Link>
      <h1 className="text-2xl font-semibold">Novo romaneio avulso</h1>
      <FormularioAvulso />
    </div>
  );
}
