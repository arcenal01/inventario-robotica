import type { ReactNode } from "react";
import { Cabecalho } from "@/components/cabecalho";
import { Navegacao } from "@/components/navegacao";
import { exigirAprovado } from "@/lib/auth/perfil";
import { itensParaPapel } from "@/lib/navegacao";

/** Todas as telas dentro de (app) exigem login E cadastro aprovado. */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await exigirAprovado();

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho perfil={perfil} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-24 md:pb-6 print:max-w-none print:p-0">{children}</main>
      <Navegacao itens={itensParaPapel(perfil.perfil)} posicao="base" />
    </div>
  );
}
