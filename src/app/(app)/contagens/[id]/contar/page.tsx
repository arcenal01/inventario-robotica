import type { Metadata } from "next";
import Link from "next/link";
import { ContarPosicao } from "@/features/contagens/contar-posicao";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Contar posição" };

export default async function PaginaContar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ endereco?: string }>;
}) {
  const { id } = await params;
  const { endereco } = await searchParams;
  await exigirAprovado();

  return (
    <div className="space-y-4">
      <Link href={`/contagens/${id}`} className="text-sm text-primary hover:underline">
        Voltar para a contagem
      </Link>
      <h1 className="text-2xl font-semibold">Contar posição</h1>
      <ContarPosicao contagemId={id} enderecoInicial={endereco ?? null} />
    </div>
  );
}
