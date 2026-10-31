import type { Metadata } from "next";
import Link from "next/link";
import { FolhaRomaneio } from "@/features/romaneios/folha-romaneio";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Imprimir romaneio" };

export default async function PaginaImprimirRomaneio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href={`/romaneios/${id}`} className="text-sm text-primary hover:underline print:hidden">
        Voltar para o romaneio
      </Link>
      <FolhaRomaneio id={id} />
    </div>
  );
}
