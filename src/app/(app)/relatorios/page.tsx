import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ChevronRight, History, ScanLine, Warehouse, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { INFO_RELATORIO, TIPOS_RELATORIO, type TipoRelatorio } from "@/features/relatorios/regras";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Relatórios" };

const ICONE: Record<TipoRelatorio, LucideIcon> = {
  estoque: Warehouse,
  movimentacoes: History,
  emprestimos: ArrowLeftRight,
  divergencias: ScanLine,
};

export default async function PaginaRelatorios() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Veja na tela, baixe em CSV (Excel) ou imprima / salve em PDF.</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {TIPOS_RELATORIO.map((t) => {
          const Icone = ICONE[t];
          return (
            <li key={t}>
              <Link href={`/relatorios/${t}`} className="group block h-full">
                <Card className="flex h-full items-center gap-4 p-4 pressionar-suave group-hover:border-primary/50 group-hover:bg-accent">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{INFO_RELATORIO[t].titulo}</span>
                    <span className="block text-sm text-muted-foreground">{INFO_RELATORIO[t].descricao}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
