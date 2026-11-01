"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { abrirBanco, type ConsultaGuardada } from "./banco";
import { ContextoOffline, sincronizarFila, type EstadoOffline, type ResultadoEnvio } from "./fila";
import { prepararOffline } from "./preparar";
import { deveGuardar, textoDaChave } from "./regras";

const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // cópia com mais de 30 dias é descartada
const PREPARAR_A_CADA_MS = 10 * 60 * 1000;
const ENVIAR_A_CADA_MS = 20 * 1000;

/**
 * Dados no aparelho (Bloco 15A), para todas as telas logadas:
 * 1. ao abrir, devolve às telas as cópias guardadas no IndexedDB (abrem mesmo sem conexão);
 * 2. guarda uma cópia de cada consulta de itens/endereços/saldos/contagens que chega do servidor;
 * 3. com conexão, baixa o que falta para consulta e contagem offline (preparar.ts);
 * 4. envia a fila de contagens guardadas quando a conexão volta (e a cada 20 s enquanto houver fila).
 */
export function DadosOffline({ usuarioId, children }: { usuarioId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const banco = useMemo(() => (typeof window === "undefined" ? null : abrirBanco(usuarioId)), [usuarioId]);
  const [ultimoEnvio, setUltimoEnvio] = useState<ResultadoEnvio | null>(null);
  const [preparadoEm, setPreparadoEm] = useState<number | null>(null);

  // 1 e 2: cópias das consultas
  useEffect(() => {
    if (!banco) return;
    let vivo = true;
    const aGravar = new Map<string, ConsultaGuardada>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gravar = () => {
      const lote = [...aGravar.values()];
      aGravar.clear();
      if (lote.length > 0) void banco.consultas.bulkPut(lote).catch(() => undefined);
    };
    const cancelar = queryClient.getQueryCache().subscribe((evento) => {
      if (evento.type !== "updated" || evento.action.type !== "success") return;
      const { queryKey, state } = evento.query;
      if (!deveGuardar(queryKey) || state.data === undefined) return;
      const chave = textoDaChave(queryKey);
      aGravar.set(chave, { chave, queryKey: [...queryKey], dados: state.data, atualizadoEm: state.dataUpdatedAt });
      clearTimeout(timer);
      timer = setTimeout(gravar, 300); // grava em lote (a preparação gera centenas de consultas de uma vez)
    });

    void banco.consultas
      .toArray()
      .then(async (guardadas) => {
        const vencidas: string[] = [];
        for (const g of guardadas) {
          if (Date.now() - g.atualizadoEm > VALIDADE_MS) {
            vencidas.push(g.chave);
            continue;
          }
          if (!vivo) return;
          const estado = queryClient.getQueryState(g.queryKey);
          if (estado?.data !== undefined && estado.dataUpdatedAt >= g.atualizadoEm) continue; // a tela já tem dado mais novo
          queryClient.setQueryData(g.queryKey, g.dados, { updatedAt: g.atualizadoEm });
        }
        if (vencidas.length > 0) await banco.consultas.bulkDelete(vencidas);
      })
      .catch(() => undefined);
    void banco.meta
      .get("preparado_em")
      .then((m) => vivo && m && setPreparadoEm(m.valor))
      .catch(() => undefined);

    return () => {
      vivo = false;
      cancelar();
      clearTimeout(timer);
      gravar();
    };
  }, [banco, queryClient]);

  // 4: envio da fila
  const sincronizar = useCallback(async () => {
    if (!banco || !navigator.onLine) return null;
    const r = await sincronizarFila(banco);
    if (r.enviados + r.recusados > 0) {
      setUltimoEnvio(r);
      await queryClient.invalidateQueries({ queryKey: ["contagens"] });
    }
    return r;
  }, [banco, queryClient]);

  // 3 e 4: quando enviar e quando baixar
  useEffect(() => {
    if (!banco) return;
    let vivo = true;
    let preparando = false;
    async function preparar() {
      if (preparando || !navigator.onLine) return;
      preparando = true;
      const ok = await prepararOffline(queryClient);
      preparando = false;
      if (ok && vivo && banco) {
        const agora = Date.now();
        setPreparadoEm(agora);
        await banco.meta.put({ nome: "preparado_em", valor: agora }).catch(() => undefined);
      }
    }
    // conexão voltou: primeiro envia o que foi contado offline, depois baixa a situação nova
    const aoConectar = () => void sincronizar().then(preparar);
    const aoVoltarAoApp = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    const inicio = setTimeout(aoConectar, 1500); // deixa a tela atual carregar primeiro
    const envio = setInterval(() => void sincronizar(), ENVIAR_A_CADA_MS);
    const preparo = setInterval(() => void preparar(), PREPARAR_A_CADA_MS);
    window.addEventListener("online", aoConectar);
    document.addEventListener("visibilitychange", aoVoltarAoApp);
    return () => {
      vivo = false;
      clearTimeout(inicio);
      clearInterval(envio);
      clearInterval(preparo);
      window.removeEventListener("online", aoConectar);
      document.removeEventListener("visibilitychange", aoVoltarAoApp);
    };
  }, [banco, queryClient, sincronizar]);

  const valor = useMemo<EstadoOffline>(() => ({ banco, sincronizar, ultimoEnvio, preparadoEm }), [banco, sincronizar, ultimoEnvio, preparadoEm]);
  return <ContextoOffline.Provider value={valor}>{children}</ContextoOffline.Provider>;
}
