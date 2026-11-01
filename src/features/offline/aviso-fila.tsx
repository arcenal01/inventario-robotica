"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, CloudUpload } from "lucide-react";
import { useFila, useOffline } from "./fila";
import { resumoFila } from "./regras";

const MOSTRAR_ENVIO_MS = 10_000;

/** Faixa abaixo do topo: contagens guardadas neste aparelho esperando envio, recusadas, ou "enviadas agora". */
export function AvisoFila() {
  const fila = useFila();
  const { sincronizar, ultimoEnvio } = useOffline();
  const [enviando, setEnviando] = useState(false);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const { pendentes, recusados } = resumoFila(fila);

  useEffect(() => {
    if (!ultimoEnvio || ultimoEnvio.enviados === 0) return;
    setMostrarEnvio(true);
    const t = setTimeout(() => setMostrarEnvio(false), MOSTRAR_ENVIO_MS);
    return () => clearTimeout(t);
  }, [ultimoEnvio]);

  const recusado = fila.find((e) => e.estado === "recusado");

  return (
    <div className="print:hidden">
      {pendentes > 0 ? (
        <div role="status" className="border-b border-primary/30 bg-primary/10 text-foreground">
          <p className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm md:px-8">
            <CloudUpload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <span className="font-semibold">{pendentes === 1 ? "1 contagem guardada" : `${pendentes} contagens guardadas`} neste aparelho.</span>{" "}
              Serão enviadas sozinhas quando a conexão voltar.
            </span>
            <button
              type="button"
              className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-medium hover:bg-primary/15 disabled:opacity-60"
              disabled={enviando}
              onClick={async () => {
                setEnviando(true);
                await sincronizar();
                setEnviando(false);
              }}
            >
              {enviando ? "Enviando..." : "Enviar agora"}
            </button>
          </p>
        </div>
      ) : null}
      {recusado ? (
        <div role="alert" className="border-b border-red-300/40 bg-red-50 text-red-800">
          <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm md:px-8">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">
                {recusados === 1 ? "1 contagem guardada foi recusada" : `${recusados} contagens guardadas foram recusadas`} pelo servidor.
              </span>{" "}
              <Link href={`/contagens/${recusado.contagemId}/contar`} className="underline">
                Ver o motivo
              </Link>
            </span>
          </p>
        </div>
      ) : null}
      {mostrarEnvio && ultimoEnvio && pendentes === 0 ? (
        <div role="status" className="border-b border-emerald-300/40 bg-emerald-50 text-emerald-900">
          <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm md:px-8">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {ultimoEnvio.enviados === 1 ? "1 contagem guardada foi enviada" : `${ultimoEnvio.enviados} contagens guardadas foram enviadas`} ao
              servidor.
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
