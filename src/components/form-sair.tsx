"use client";

import type { ReactNode } from "react";
import { limparPaginasGuardadas } from "@/components/pwa";

/** Formulário de logout que também apaga as páginas guardadas pelo service worker neste aparelho. */
export function FormSair({ children }: { children: ReactNode }) {
  return (
    <form action="/sair" method="post" onSubmit={limparPaginasGuardadas}>
      {children}
    </form>
  );
}
