"use client";

import { useEffect, useState } from "react";
import { CloudOff, ServerCrash } from "lucide-react";
import { useOffline } from "@/features/offline/fila";
import { descreverAtualizacao } from "@/features/offline/regras";
import { env, urlSupabaseNavegador } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Registra o service worker (só no app de produção e em endereço seguro: https ou localhost). */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sem service worker o app funciona normalmente, só não abre offline
    });
  }, []);
  return null;
}

/** Ao sair: avisa o service worker para apagar as páginas guardadas (podem ter dados da pessoa). */
export function limparPaginasGuardadas() {
  navigator.serviceWorker?.controller?.postMessage("sair");
}

export type EstadoConexao = "online" | "sem_internet" | "servidor_fora";

const INTERVALO_MS = 30_000;

/** Acompanha a conexão: o aparelho está online? E o servidor (Supabase) responde? */
export function useConexao(): EstadoConexao {
  const [estado, setEstado] = useState<EstadoConexao>("online");

  useEffect(() => {
    let vivo = true;
    async function verificar() {
      if (!navigator.onLine) {
        if (vivo) setEstado("sem_internet");
        return;
      }
      try {
        const controle = new AbortController();
        const prazo = setTimeout(() => controle.abort(), 8000);
        const r = await fetch(`${urlSupabaseNavegador()}/auth/v1/health`, {
          headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
          cache: "no-store",
          signal: controle.signal,
        });
        clearTimeout(prazo);
        if (vivo) setEstado(r.ok ? "online" : "servidor_fora");
      } catch {
        if (vivo) setEstado(navigator.onLine ? "servidor_fora" : "sem_internet");
      }
    }
    void verificar();
    const timer = setInterval(() => void verificar(), INTERVALO_MS);
    const aoMudar = () => void verificar();
    window.addEventListener("online", aoMudar);
    window.addEventListener("offline", aoMudar);
    document.addEventListener("visibilitychange", aoMudar);
    return () => {
      vivo = false;
      clearInterval(timer);
      window.removeEventListener("online", aoMudar);
      window.removeEventListener("offline", aoMudar);
      document.removeEventListener("visibilitychange", aoMudar);
    };
  }, []);

  return estado;
}

const TEXTO: Record<Exclude<EstadoConexao, "online">, { curto: string; longo: string }> = {
  sem_internet: {
    curto: "Offline",
    longo: "Sem conexão.",
  },
  servidor_fora: {
    curto: "Servidor fora",
    longo: "O aparelho tem rede, mas o servidor da sala não responde. Verifique se o computador da sala está ligado.",
  },
};

/** Faixa de aviso logo abaixo do topo (some quando está tudo online). */
export function AvisoConexao() {
  const estado = useConexao();
  const { preparadoEm } = useOffline();
  if (estado === "online") return null;
  const Icone = estado === "sem_internet" ? CloudOff : ServerCrash;
  return (
    <div role="status" className="border-b border-amber-300/50 bg-amber-50 text-amber-900 print:hidden">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm md:px-8">
        <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">{TEXTO[estado].curto}.</span> {TEXTO[estado].longo} Itens, endereços e contagens
          {preparadoEm ? ` mostram os dados guardados neste aparelho (${descreverAtualizacao(preparadoEm)})` : " mostram só o que já estava carregado"}; contagens
          ficam guardadas e são enviadas quando a conexão voltar. O resto do app precisa de conexão.
        </span>
      </p>
    </div>
  );
}

/** Bolinha no topo: verde online, amarela sem rede/servidor (com texto curto ao lado). */
export function IndicadorConexao({ className }: { className?: string }) {
  const estado = useConexao();
  const online = estado === "online";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", !online && "bg-amber-100 text-amber-900", className)}
      title={online ? "Conectado" : TEXTO[estado].longo}
      aria-label={online ? "Conectado" : TEXTO[estado].curto}
    >
      <span className={cn("h-2 w-2 rounded-full", online ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/70" : "bg-amber-500")} />
      {online ? null : TEXTO[estado].curto}
    </span>
  );
}
