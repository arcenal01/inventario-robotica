"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/datas";
import { useRomaneios } from "./consultas";
import { ABERTOS, COR_STATUS_ROMANEIO, ROTULO_STATUS_ROMANEIO } from "./regras";

/** Romaneios em aberto (gerado, em separação, separado) e encerrados (entregue, cancelado). */
export function ListaRomaneios() {
  const romaneiosQ = useRomaneios();
  const [abertos, setAbertos] = useState(true);
  const lista = (romaneiosQ.data ?? []).filter((r) => ABERTOS.includes(r.status) === abertos);

  return (
    <div className="space-y-4">
      <Link
        href="/romaneios/novo"
        className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Novo romaneio avulso
      </Link>
      <p className="text-xs text-muted-foreground">Romaneio de pedido: abra o pedido aprovado e toque em Gerar romaneio.</p>

      <div className="flex gap-2" role="tablist">
        {[true, false].map((a) => (
          <Button key={String(a)} role="tab" aria-selected={abertos === a} size="sm" variant={abertos === a ? "default" : "outline"} onClick={() => setAbertos(a)}>
            {a ? "Em aberto" : "Entregues e cancelados"}
          </Button>
        ))}
      </div>

      {romaneiosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      {romaneiosQ.isError ? <p className="text-sm text-red-800">Erro: {romaneiosQ.error.message}</p> : null}
      {romaneiosQ.data && lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum romaneio.</p> : null}

      <ul className="space-y-2">
        {lista.map((r) => (
          <li key={r.id}>
            <Link href={`/romaneios/${r.id}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="space-y-1 p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-semibold">{r.codigo}</span>
                    <Badge variant={COR_STATUS_ROMANEIO[r.status]}>{ROTULO_STATUS_ROMANEIO[r.status]}</Badge>
                  </div>
                  <p className="truncate text-sm">
                    {r.pedido ? `Pedido ${r.pedido.codigo} · ${r.pedido.solicitante?.nome ?? ""}` : `Avulso: ${r.descricao ?? ""}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.itens[0]?.count === 1 ? "1 linha" : `${r.itens[0]?.count ?? 0} linhas`} · {formatarDataHora(r.atualizado_em)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
