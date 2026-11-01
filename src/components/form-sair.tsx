"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { limparPaginasGuardadas } from "@/components/pwa";
import { apagarBancoAtual } from "@/features/offline/banco";
import { useOffline } from "@/features/offline/fila";

/**
 * Formulário de logout. Antes de sair:
 * - tenta enviar as contagens guardadas neste aparelho; se ainda sobrar alguma, pede confirmação (seriam perdidas);
 * - apaga as páginas guardadas pelo service worker e os dados guardados no aparelho (IndexedDB).
 */
export function FormSair({ children }: { children: ReactNode }) {
  const { banco, sincronizar } = useOffline();
  const [saindo, setSaindo] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (saindo) return;
    const form = evento.currentTarget;
    setSaindo(true);
    try {
      let naoEnviados = banco ? await banco.fila.count() : 0;
      if (naoEnviados > 0) {
        await sincronizar();
        naoEnviados = banco ? await banco.fila.count() : 0;
      }
      if (
        naoEnviados > 0 &&
        !window.confirm(
          `${naoEnviados === 1 ? "1 contagem" : `${naoEnviados} contagens`} deste aparelho ainda não chegou ao servidor. ` +
            "Se sair agora, ela será apagada. Sair mesmo assim?",
        )
      ) {
        setSaindo(false);
        return;
      }
    } catch {
      // erro ao ler a fila não impede sair
    }
    limparPaginasGuardadas();
    await apagarBancoAtual();
    form.submit(); // submit() direto não passa de novo por aqui
  }

  return (
    <form action="/sair" method="post" onSubmit={(e) => void aoEnviar(e)} aria-busy={saindo}>
      {children}
    </form>
  );
}
