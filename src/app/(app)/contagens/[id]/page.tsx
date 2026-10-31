import type { Metadata } from "next";
import Link from "next/link";
import { DetalheContagem } from "@/features/contagens/detalhe-contagem";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Contagem" };

export default async function PaginaContagem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <Link href="/contagens" className="text-sm text-primary hover:underline">
        Voltar para contagens
      </Link>
      <DetalheContagem id={id} equipe={perfil.perfil !== "aluno"} />
    </div>
  );
}
