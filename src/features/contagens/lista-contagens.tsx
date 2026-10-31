"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/datas";
import { useContagens, type Contagem } from "./consultas";
import { DialogoNovaContagem } from "./dialogo-nova-contagem";
import { ABERTAS, COR_STATUS_CONTAGEM, ROTULO_ESCOPO, ROTULO_STATUS_CONTAGEM } from "./regras";

export function descreverEscopo(c: Pick<Contagem, "escopo" | "endereco" | "categoria">): string {
  if (c.escopo === "por_endereco") return `${ROTULO_ESCOPO.por_endereco} ${c.endereco?.codigo ?? "?"}`;
  if (c.escopo === "por_categoria") return `${ROTULO_ESCOPO.por_categoria} ${c.categoria?.nome ?? "?"}`;
  return ROTULO_ESCOPO.geral;
}

/** Contagens em andamento (aberta, em andamento, em revisão) e encerradas (aprovada, cancelada). */
export function ListaContagens({ equipe }: { equipe: boolean }) {
  const contagensQ = useContagens();
  const [abertas, setAbertas] = useState(true);
  const [criando, setCriando] = useState(false);
  const lista = (contagensQ.data ?? []).filter((c) => ABERTAS.includes(c.status) === abertas);

  return (
    <div className="space-y-4">
      {equipe ? <Button onClick={() => setCriando(true)}>Nova contagem</Button> : null}
      {!equipe ? <p className="text-sm text-muted-foreground">Abra uma contagem em andamento e conte as posições que ainda faltam.</p> : null}

      <div className="flex gap-2" role="tablist">
        {[true, false].map((a) => (
          <Button key={String(a)} role="tab" aria-selected={abertas === a} size="sm" variant={abertas === a ? "default" : "outline"} onClick={() => setAbertas(a)}>
            {a ? "Em andamento" : "Encerradas"}
          </Button>
        ))}
      </div>

      {contagensQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      {contagensQ.isError ? <p className="text-sm text-red-800">Erro: {contagensQ.error.message}</p> : null}
      {contagensQ.data && lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma contagem.</p> : null}

      <ul className="space-y-2">
        {lista.map((c) => (
          <li key={c.id}>
            <Link href={`/contagens/${c.id}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="space-y-1 p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-semibold">{c.codigo}</span>
                    <Badge variant={COR_STATUS_CONTAGEM[c.status]}>{ROTULO_STATUS_CONTAGEM[c.status]}</Badge>
                  </div>
                  <p className="truncate text-sm">{descreverEscopo(c)}</p>
                  <p className="text-xs text-muted-foreground">
                    Aberta em {formatarDataHora(c.criado_em)}
                    {c.abertaPor ? ` por ${c.abertaPor.nome}` : ""}
                    {c.observacao ? ` · ${c.observacao}` : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {criando ? <DialogoNovaContagem aoFechar={() => setCriando(false)} /> : null}
    </div>
  );
}
