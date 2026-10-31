import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { StatusRomaneio } from "./regras";

export type RomaneioResumo = {
  id: string;
  codigo: string;
  descricao: string | null;
  status: StatusRomaneio;
  criado_em: string;
  atualizado_em: string;
  pedido: { codigo: string; solicitante: { nome: string } | null } | null;
  itens: { count: number }[];
};

/** Romaneios (professor/admin veem todos). Mais recentes primeiro. */
export function useRomaneios() {
  return useQuery({
    queryKey: ["romaneios"],
    queryFn: async (): Promise<RomaneioResumo[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("romaneios")
        .select(
          `id, codigo, descricao, status, criado_em, atualizado_em,
           pedido:pedidos!romaneios_pedido_id_fkey(codigo, solicitante:perfis!pedidos_solicitante_id_fkey(nome)),
           itens:romaneio_itens(count)`,
        )
        .order("atualizado_em", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type LinhaRomaneio = {
  id: string;
  quantidade: number;
  separado: boolean;
  quantidade_conferida: number | null;
  movimentacao_id: string | null;
  item: { id: string; codigo: string; nome: string; unidade: string; tipo_controle: "consumivel" | "emprestavel" };
  endereco: { codigo: string; nome: string | null };
};

export type RomaneioCompleto = Omit<RomaneioResumo, "itens" | "pedido"> & {
  prazo_devolucao: string | null;
  separado_em: string | null;
  entregue_em: string | null;
  pedido: { id: string; codigo: string; solicitante_id: string; finalidade: string; solicitante: { nome: string; turma: string | null } | null } | null;
  criador: { nome: string } | null;
  separador: { nome: string } | null;
  recebedor: { nome: string; turma: string | null } | null;
  itens: LinhaRomaneio[];
};

export function useRomaneio(id: string) {
  return useQuery({
    queryKey: ["romaneios", id],
    queryFn: async (): Promise<RomaneioCompleto | null> => {
      const { data, error } = await criarClienteNavegador()
        .from("romaneios")
        .select(
          `id, codigo, descricao, status, criado_em, atualizado_em, prazo_devolucao, separado_em, entregue_em,
           pedido:pedidos!romaneios_pedido_id_fkey(id, codigo, solicitante_id, finalidade,
             solicitante:perfis!pedidos_solicitante_id_fkey(nome, turma)),
           criador:perfis!romaneios_criado_por_fkey(nome),
           separador:perfis!romaneios_separado_por_fkey(nome),
           recebedor:perfis!romaneios_recebido_por_fkey(nome, turma),
           itens:romaneio_itens(id, quantidade, separado, quantidade_conferida, movimentacao_id,
             item:itens!romaneio_itens_item_id_fkey(id, codigo, nome, unidade, tipo_controle),
             endereco:enderecos!romaneio_itens_endereco_retirada_id_fkey(codigo, nome))`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        ...data,
        itens: data.itens.map((l) => ({
          ...l,
          quantidade: Number(l.quantidade),
          quantidade_conferida: l.quantidade_conferida === null ? null : Number(l.quantidade_conferida),
        })),
      };
    },
  });
}
