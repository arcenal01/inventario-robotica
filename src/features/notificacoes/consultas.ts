import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

export type Notificacao = Tables<"notificacoes">;

const UM_MINUTO = 60_000;

/** Quantas notificações não lidas (o RLS só devolve as do próprio usuário). Atualiza a cada minuto. */
export function useNaoLidas() {
  return useQuery({
    queryKey: ["notificacoes", "nao_lidas"],
    refetchInterval: UM_MINUTO,
    queryFn: async (): Promise<number> => {
      const { count, error } = await criarClienteNavegador()
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("lida", false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

export function useNotificacoes() {
  return useQuery({
    queryKey: ["notificacoes", "lista"],
    queryFn: async (): Promise<Notificacao[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("notificacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
