import type { Metadata } from "next";
import Link from "next/link";
import { DetalheRomaneio } from "@/features/romaneios/detalhe-romaneio";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Romaneio" };

export default async function PaginaRomaneio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href="/romaneios" className="text-sm text-primary hover:underline">
        Voltar para romaneios
      </Link>
      <DetalheRomaneio id={id} />
    </div>
  );
}
