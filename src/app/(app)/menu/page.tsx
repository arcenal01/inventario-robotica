import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { exigirAprovado } from "@/lib/auth/perfil";
import { iconeDe } from "@/lib/icones";
import { itensParaPapel } from "@/lib/navegacao";

export const metadata: Metadata = { title: "Menu" };

/** Menu completo (no celular a barra de baixo mostra só os principais). */
export default async function PaginaMenu() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Menu</h1>
      <ul className="grid grid-cols-2 gap-3">
        {itensParaPapel(perfil.perfil).map((item) => {
          const Icone = iconeDe(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className="group block">
                <Card className="flex items-center gap-3 p-4 transition-colors group-hover:border-primary/50 group-hover:bg-accent">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.rotulo}</span>
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
