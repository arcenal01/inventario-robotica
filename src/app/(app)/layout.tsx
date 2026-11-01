import type { ReactNode } from "react";
import { BarraLateral, Cabecalho } from "@/components/cabecalho";
import { Navegacao } from "@/components/navegacao";
import { AvisoConexao } from "@/components/pwa";
import { AvisoFila } from "@/features/offline/aviso-fila";
import { DadosOffline } from "@/features/offline/dados-offline";
import { exigirAprovado } from "@/lib/auth/perfil";
import { itensParaPapel } from "@/lib/navegacao";

/** Todas as telas dentro de (app) exigem login E cadastro aprovado. DadosOffline guarda dados no aparelho (Bloco 15A). */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await exigirAprovado();

  return (
    <DadosOffline usuarioId={perfil.id}>
      <div className="min-h-dvh md:pl-60 print:pl-0">
        <BarraLateral perfil={perfil} />
        <div className="flex min-h-dvh flex-col">
          <Cabecalho perfil={perfil} />
          <AvisoConexao />
          <AvisoFila />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10 print:max-w-none print:p-0">
            {children}
          </main>
        </div>
        <Navegacao itens={itensParaPapel(perfil.perfil)} posicao="base" />
      </div>
    </DadosOffline>
  );
}
