import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAprovado } from "@/lib/auth/perfil";
import { itensParaPapel } from "@/lib/navegacao";

export const metadata: Metadata = { title: "Menu" };

/** Menu completo (no celular a barra de baixo mostra só os principais). */
export default async function PaginaMenu() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Menu</h1>
      <ul className="grid grid-cols-2 gap-2">
        {itensParaPapel(perfil.perfil).map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="p-4 sm:p-4">
                  <CardTitle className="text-base">{item.rotulo}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
