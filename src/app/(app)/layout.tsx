import type { ReactNode } from "react";
import { BarraLateral, Cabecalho } from "@/components/cabecalho";
import { Navegacao } from "@/components/navegacao";
import { exigirAprovado } from "@/lib/auth/perfil";
import { itensParaPapel } from "@/lib/navegacao";

/** Todas as telas dentro de (app) exigem login E cadastro aprovado. */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await exigirAprovado();

  return (
    <div className="min-h-dvh md:pl-60 print:pl-0">
      <BarraLateral perfil={perfil} />
      <div className="flex min-h-dvh flex-col">
        <Cabecalho perfil={perfil} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
      <Navegacao itens={itensParaPapel(perfil.perfil)} posicao="base" />
    </div>
  );
}
