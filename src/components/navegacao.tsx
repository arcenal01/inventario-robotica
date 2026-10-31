"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconeDe } from "@/lib/icones";
import type { ItemNavegacao } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Celular: barra fixa embaixo com ícones. Computador: lista vertical da barra lateral. */
export function Navegacao({ itens, posicao }: { itens: ItemNavegacao[]; posicao: "lateral" | "base" }) {
  const pathname = usePathname();

  if (posicao === "lateral") {
    return (
      <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
        {itens.map((item) => {
          const marcado = ativo(pathname, item.href);
          const Icone = iconeDe(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={marcado ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                marcado ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {marcado ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary shadow-glow" /> : null}
              <Icone className={cn("h-[18px] w-[18px] shrink-0", marcado && "text-primary")} aria-hidden="true" />
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    );
  }

  // No celular só cabem os principais; os outros ficam na página "Mais" (/menu)
  const visiveis = itens.filter((i) => i.principal);
  const temMais = visiveis.length < itens.length;
  const lista = temMais ? [...visiveis, { href: "/menu", rotulo: "Mais", papeis: [] }] : visiveis;
  const algumOutroMarcado = visiveis.some((i) => ativo(pathname, i.href));

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden print:hidden"
    >
      {lista.map((item) => {
        const marcado = item.href === "/menu" ? !algumOutroMarcado : ativo(pathname, item.href);
        const Icone = iconeDe(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={marcado ? "page" : undefined}
            className={cn(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              marcado ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", marcado && "bg-accent")}>
              <Icone className="h-5 w-5" aria-hidden="true" />
            </span>
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
