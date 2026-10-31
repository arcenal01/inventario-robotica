"use client";

import Link from "next/link";
import { useNaoLidas } from "./consultas";

/** Sino do cabeçalho: leva para /notificacoes e mostra quantas não foram lidas. */
export function SinoNotificacoes() {
  const naoLidasQ = useNaoLidas();
  const n = naoLidasQ.data ?? 0;
  return (
    <Link
      href="/notificacoes"
      aria-label={n > 0 ? `Notificações: ${n} não lida(s)` : "Notificações"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {n > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-xs font-semibold leading-5 text-destructive-foreground">
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Link>
  );
}
