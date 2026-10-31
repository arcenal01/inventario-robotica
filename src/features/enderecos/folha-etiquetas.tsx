"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

export type DadosEtiqueta = {
  id: string;
  codigo: string;
  nome: string | null;
  tipo: string;
};

/**
 * O QR guarda só o CÓDIGO do endereço (ex.: ARM01-GAV03-CX02-P05), sem endereço de site.
 * Assim a etiqueta continua valendo se o sistema mudar de computador ou for para a nuvem.
 */
function Etiqueta({ dados }: { dados: DadosEtiqueta }) {
  return (
    <div className="flex break-inside-avoid items-center gap-3 rounded-md border border-dashed border-neutral-400 bg-white p-3 text-black">
      <div className="shrink-0 bg-white p-1">
        <QRCodeSVG value={dados.codigo} size={96} level="M" />
      </div>
      <div className="min-w-0">
        <p className="break-all font-mono text-base font-bold leading-tight">{dados.codigo}</p>
        {dados.nome ? <p className="text-sm leading-tight">{dados.nome}</p> : null}
        <p className="text-xs text-neutral-600">{dados.tipo}</p>
      </div>
    </div>
  );
}

export function FolhaEtiquetas({ etiquetas, titulo }: { etiquetas: DadosEtiqueta[]; titulo: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 print:hidden">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {etiquetas.length} etiqueta(s). Ao imprimir, escolha escala 100% e papel A4 (ou etiquetas adesivas). O QR contém apenas o
          código do endereço.
        </p>
        <Button onClick={() => window.print()} disabled={etiquetas.length === 0}>
          Imprimir
        </Button>
      </div>

      {etiquetas.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum endereço ativo para imprimir.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-3">
          {etiquetas.map((e) => (
            <Etiqueta key={e.id} dados={e} />
          ))}
        </div>
      )}
    </div>
  );
}
