"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ItemNavegacao } from "@/lib/navegacao";

function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Celular: barra fixa embaixo. Telas maiores: links no topo (renderizado dentro do cabeçalho). */
export function Navegacao({ itens, posicao }: { itens: ItemNavegacao[]; posicao: "topo" | "base" }) {
  const pathname = usePathname();

  const links = itens.map((item) => {
    const marcado = ativo(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={marcado ? "page" : undefined}
        className={cn(
          posicao === "base"
            ? "flex h-14 flex-1 items-center justify-center text-sm font-medium"
            : "rounded-md px-3 py-2 text-sm font-medium",
          marcado ? "text-primary" : "text-muted-foreground hover:text-foreground",
          posicao === "topo" && marcado && "bg-accent",
        )}
      >
        {item.rotulo}
      </Link>
    );
  });

  if (posicao === "base") {
    return (
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {links}
      </nav>
    );
  }

  return (
    <nav aria-label="Menu principal" className="hidden items-center gap-1 md:flex print:hidden">
      {links}
    </nav>
  );
}
