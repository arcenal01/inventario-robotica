import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

export type ItemEstoque = Tables<"vw_itens_estoque">;
export type Categoria = Tables<"categorias">;

/** Linha da view sem nulos nos campos que a tela usa (a view sempre preenche estes campos). */
export type ItemLista = ItemEstoque & {
  id: string;
  codigo: string;
  nome: string;
  categoria_id: string;
  categoria_nome: string;
  unidade: "un" | "m" | "kg";
  tipo_controle: "consumivel" | "emprestavel";
  status: "ativo" | "inativo";
  saldo_total: number;
  emprestado_em_aberto: number;
  estoque_minimo: number;
  abaixo_minimo: boolean;
};

/** Todos os itens com saldo. Para uma sala (centenas de itens) carregar tudo e filtrar no celular é mais rápido. */
export function useItens() {
  return useQuery({
    queryKey: ["itens"],
    queryFn: async (): Promise<ItemLista[]> => {
      const { data, error } = await criarClienteNavegador().from("vw_itens_estoque").select("*").order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemLista[];
    },
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await criarClienteNavegador().from("categorias").select("*").order("nome");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type SaldoEndereco = {
  endereco_id: string;
  quantidade_atual: number;
  codigo: string;
  nome: string | null;
  ativo: boolean;
};

/** Onde o item está guardado: um saldo por posição (só as que têm quantidade). */
export function useSaldosDoItem(itemId: string | null) {
  return useQuery({
    queryKey: ["saldos", itemId],
    enabled: Boolean(itemId),
    queryFn: async (): Promise<SaldoEndereco[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("saldos_por_endereco")
        .select("endereco_id, quantidade_atual, endereco:enderecos!inner(codigo, nome, ativo)")
        .eq("item_id", itemId!)
        .gt("quantidade_atual", 0);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((s) => ({
          endereco_id: s.endereco_id,
          quantidade_atual: Number(s.quantidade_atual),
          codigo: s.endereco.codigo,
          nome: s.endereco.nome,
          ativo: s.endereco.ativo,
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
    },
  });
}
