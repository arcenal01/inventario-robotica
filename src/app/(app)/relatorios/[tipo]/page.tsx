import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Relatorio } from "@/features/relatorios/relatorios";
import { INFO_RELATORIO, eTipoRelatorio } from "@/features/relatorios/regras";
import { exigirPapel } from "@/lib/auth/perfil";

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }): Promise<Metadata> {
  const { tipo } = await params;
  return { title: eTipoRelatorio(tipo) ? INFO_RELATORIO[tipo].titulo : "Relatório" };
}

export default async function PaginaRelatorio({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  await exigirPapel(["admin", "professor"]);
  if (!eTipoRelatorio(tipo)) notFound();

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/relatorios" className="text-sm text-primary hover:underline">
          Voltar para relatórios
        </Link>
        <h1 className="text-2xl font-semibold">{INFO_RELATORIO[tipo].titulo}</h1>
        <p className="text-sm text-muted-foreground">{INFO_RELATORIO[tipo].descricao}</p>
      </div>
      <Relatorio tipo={tipo} />
    </div>
  );
}
