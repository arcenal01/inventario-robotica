import { queryOptions, useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Endereco, TipoEndereco } from "./arvore";

/** Todos os endereços (ativos e inativos). Poucas centenas de linhas: carregamos tudo e montamos a árvore no cliente. */
export const consultaEnderecos = queryOptions({
  queryKey: ["enderecos"],
  queryFn: async (): Promise<Endereco[]> => {
    const { data, error } = await criarClienteNavegador().from("enderecos").select("*").order("codigo");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function useEnderecos() {
  return useQuery(consultaEnderecos);
}

export const consultaTiposEndereco = queryOptions({
  queryKey: ["tipos_endereco"],
  queryFn: async (): Promise<TipoEndereco[]> => {
    const { data, error } = await criarClienteNavegador()
      .from("tipos_endereco")
      .select("*")
      .order("nivel")
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function useTiposEndereco() {
  return useQuery(consultaTiposEndereco);
}

/** Quantidade de trocas de QR pendentes (só professor/admin conseguem ver). */
export function useTrocasPendentes(habilitado: boolean) {
  return useQuery({
    queryKey: ["trocas_qr", "pendentes"],
    enabled: habilitado,
    queryFn: async (): Promise<number> => {
      const { count, error } = await criarClienteNavegador()
        .from("trocas_qr")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}
