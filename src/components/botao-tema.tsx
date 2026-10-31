"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { aplicarTema } from "@/lib/tema";
import { cn } from "@/lib/utils";

/** Alterna entre tema escuro e claro. */
export function BotaoTema({ className, comTexto = false }: { className?: string; comTexto?: boolean }) {
  const [escuro, setEscuro] = useState(true);

  // a classe no <html> foi definida pelo script do <head>; lê depois de montar
  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  const Icone = escuro ? Sun : Moon;
  const rotulo = escuro ? "Tema claro" : "Tema escuro";

  return (
    <button
      type="button"
      onClick={() => {
        aplicarTema(escuro ? "claro" : "escuro");
        setEscuro(!escuro);
      }}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icone className="h-4 w-4" aria-hidden="true" />
      {comTexto ? <span>{rotulo}</span> : null}
    </button>
  );
}
