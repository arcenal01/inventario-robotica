import type { Metadata } from "next";
import { PainelPendencias } from "@/features/offline/painel-pendencias";

export const metadata: Metadata = { title: "Pendências" };

/** Contagens guardadas neste aparelho que ainda não chegaram ao servidor (Bloco 15B). Login exigido pelo layout. */
export default function PaginaPendencias() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pendências deste aparelho</h1>
        <p className="text-sm text-muted-foreground">Contagens feitas sem conexão que ainda não chegaram ao servidor.</p>
      </div>
      <PainelPendencias />
    </div>
  );
}
