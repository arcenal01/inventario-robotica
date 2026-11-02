"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { BancoOffline } from "./banco";
import { eFalhaTemporaria, type EnvioFila } from "./regras";

export type ResultadoEnvio = { enviados: number; duplicados: number; recusados: number; quando: number };

export type EstadoOffline = {
  banco: BancoOffline | null;
  /** Manda agora o que está na fila (se houver conexão). */
  sincronizar: () => Promise<ResultadoEnvio | null>;
  /** Resultado do último envio que mandou ou recusou algo (para o aviso no topo). */
  ultimoEnvio: ResultadoEnvio | null;
  /** Quando os dados foram baixados para uso offline pela última vez (null = nunca neste aparelho). */
  preparadoEm: number | null;
};

export const ContextoOffline = createContext<EstadoOffline>({
  banco: null,
  sincronizar: async () => null,
  ultimoEnvio: null,
  preparadoEm: null,
});

export function useOffline() {
  return useContext(ContextoOffline);
}

/** Lista da fila do aparelho, atualizada sozinha quando algo entra ou sai (liveQuery do Dexie). */
export function useFila(): EnvioFila[] {
  return useFilaComEstado().fila;
}

/** Igual a useFila, dizendo também se a primeira leitura do aparelho já terminou (evita mostrar "vazio" antes da hora). */
export function useFilaComEstado(): { fila: EnvioFila[]; carregada: boolean } {
  const { banco } = useOffline();
  const [estado, setEstado] = useState<{ fila: EnvioFila[]; carregada: boolean }>({ fila: [], carregada: false });
  useEffect(() => {
    if (!banco) return;
    const assinatura = liveQuery(() => banco.fila.orderBy("criadoEm").toArray()).subscribe({
      next: (fila) => setEstado({ fila, carregada: true }),
      error: () => setEstado({ fila: [], carregada: true }),
    });
    return () => assinatura.unsubscribe();
  }, [banco]);
  return estado;
}

export async function enfileirar(banco: BancoOffline, envio: Omit<EnvioFila, "criadoEm" | "estado" | "motivo" | "tentativas">) {
  await banco.fila.put({ ...envio, criadoEm: Date.now(), estado: "pendente", motivo: null, tentativas: 0 });
}

type Resposta = { tipo: "ok"; duplicada: boolean } | { tipo: "temporaria" } | { tipo: "recusada"; motivo: string };

async function enviar(e: EnvioFila): Promise<Resposta> {
  try {
    const { data, error, status } = await criarClienteNavegador().rpc("registrar_contagem", {
      p_contagem_id: e.contagemId,
      p_endereco_id: e.enderecoId,
      p_itens: e.itens,
      p_chave_idempotencia: e.chave,
    });
    if (!error) return { tipo: "ok", duplicada: Boolean((data as { duplicada?: boolean } | null)?.duplicada) };
    if (eFalhaTemporaria(status, error.message)) return { tipo: "temporaria" };
    return { tipo: "recusada", motivo: traduzirErroBanco(error.message) };
  } catch {
    return { tipo: "temporaria" };
  }
}

let emAndamento: Promise<ResultadoEnvio> | null = null;

/**
 * Envia a fila em ordem de criação. Sucesso (ou "duplicada" = já tinha chegado antes) sai da fila;
 * falha de rede para tudo e tenta depois; recusa do banco fica marcada como "recusado" com o motivo.
 * Um envio por vez, também entre abas abertas (Web Locks, quando o navegador tem).
 */
export function sincronizarFila(banco: BancoOffline): Promise<ResultadoEnvio> {
  if (emAndamento) return emAndamento;
  const executar = async (): Promise<ResultadoEnvio> => {
    const r: ResultadoEnvio = { enviados: 0, duplicados: 0, recusados: 0, quando: Date.now() };
    const pendentes = await banco.fila.where("estado").equals("pendente").sortBy("criadoEm");
    for (const e of pendentes) {
      const resposta = await enviar(e);
      if (resposta.tipo === "temporaria") {
        await banco.fila.update(e.chave, { tentativas: e.tentativas + 1 });
        break;
      }
      if (resposta.tipo === "ok") {
        await banco.fila.delete(e.chave);
        r.enviados += 1;
        if (resposta.duplicada) r.duplicados += 1;
      } else {
        await banco.fila.update(e.chave, { estado: "recusado", motivo: resposta.motivo, tentativas: e.tentativas + 1 });
        r.recusados += 1;
      }
    }
    return r;
  };
  const travas = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const comTrava = travas
    ? new Promise<ResultadoEnvio>((ok, falha) => {
        void travas.request("inventario-fila", () => executar().then(ok, falha)).catch(falha);
      })
    : executar();
  const envio = comTrava.finally(() => {
    emAndamento = null;
  });
  emAndamento = envio;
  return envio;
}

// ---------------------------------------------------------------------
// Bloco 15B: ações da tela de pendências
// ---------------------------------------------------------------------

/** Apaga o envio do aparelho (o que foi contado nele se perde). */
export async function descartarEnvio(banco: BancoOffline, chave: string) {
  await banco.fila.delete(chave);
}

/** Recusado volta para a fila como está (mesma chave: o banco não gravou nada da tentativa recusada). */
export async function reenviarEnvio(banco: BancoOffline, chave: string) {
  await banco.fila.update(chave, { estado: "pendente", motivo: null });
}

/**
 * Troca os itens de um envio recusado e o põe de volta na fila com chave NOVA
 * (o conteúdo mudou; a chave antiga nunca foi gravada, mas chave nova deixa isso explícito).
 */
export async function corrigirEnvio(banco: BancoOffline, envio: EnvioFila, itens: EnvioFila["itens"], novaChave: string) {
  await banco.transaction("rw", banco.fila, async () => {
    await banco.fila.delete(envio.chave);
    await banco.fila.put({ ...envio, chave: novaChave, itens, estado: "pendente", motivo: null });
  });
}
