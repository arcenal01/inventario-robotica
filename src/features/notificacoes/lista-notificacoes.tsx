"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatarDataHora } from "@/lib/datas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useNotificacoes, type Notificacao } from "./consultas";
import { destinoNotificacao } from "./destino";

/** Últimas 50 notificações. Tocar marca como lida e abre a tela relacionada. */
export function ListaNotificacoes() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notificacoesQ = useNotificacoes();
  const naoLidas = (notificacoesQ.data ?? []).filter((n) => !n.lida).length;

  async function marcar(ids: string[] | "todas") {
    const consulta = criarClienteNavegador().from("notificacoes").update({ lida: true });
    await (ids === "todas" ? consulta.eq("lida", false) : consulta.in("id", ids));
    await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
  }

  async function abrir(n: Notificacao) {
    if (!n.lida) await marcar([n.id]);
    const destino = destinoNotificacao(n);
    if (destino) router.push(destino);
  }

  if (notificacoesQ.isPending) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (notificacoesQ.isError) return <p className="text-sm text-red-800">Erro: {notificacoesQ.error.message}</p>;
  const lista = notificacoesQ.data ?? [];

  return (
    <div className="space-y-4">
      {naoLidas > 0 ? (
        <Button variant="outline" size="sm" onClick={() => void marcar("todas")}>
          Marcar todas como lidas
        </Button>
      ) : null}
      {lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma notificação.</p> : null}
      <ul className="divide-y rounded-md border bg-card">
        {lista.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void abrir(n)}
              className={cn("block w-full px-3 py-3 text-left hover:bg-accent", !n.lida && "bg-amber-50")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn("text-sm", !n.lida && "font-semibold")}>{n.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatarDataHora(n.criado_em)}</span>
              </span>
              {n.mensagem ? <span className="block text-sm text-muted-foreground">{n.mensagem}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
