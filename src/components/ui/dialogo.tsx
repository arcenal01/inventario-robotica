"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Janela de diálogo usando o <dialog> nativo do navegador (acessível, fecha com Esc).
 * O conteúdo só existe enquanto aberto, então formulários dentro dele começam limpos a cada abertura.
 */
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        // clique no fundo escuro fecha
        if (e.target === ref.current) aoFechar();
      }}
      aria-label={titulo}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
    >
      {aberto ? (
        <div className="space-y-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
