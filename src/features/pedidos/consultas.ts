import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { StatusPedido } from "./regras";

export type PedidoResumo = {
  id: string;
  codigo: string;
  finalidade: string;
  projeto_turma: string | null;
  status: StatusPedido;
  solicitante_id: string;
  criado_em: string;
  atualizado_em: string;
  solicitante: { nome: string; turma: string | null } | null;
  itens: { count: number }[];
};

/** Lista de pedidos (aluno recebe só os próprios, pelo RLS). Mais recentes primeiro. */
export function usePedidos() {
  return useQuery({
    queryKey: ["pedidos"],
    queryFn: async (): Promise<PedidoResumo[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("pedidos")
        .select(
          `id, codigo, finalidade, projeto_turma, status, solicitante_id, criado_em, atualizado_em,
           solicitante:perfis!pedidos_solicitante_id_fkey(nome, turma),
           itens:pedido_itens(count)`,
        )
        .order("atualizado_em", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type PedidoItem = {
  id: string;
  quantidade_solicitada: number;
  quantidade_aprovada: number | null;
  observacao: string | null;
  item: { id: string; codigo: string; nome: string; unidade: string; tipo_controle: "consumivel" | "emprestavel" };
};

export type PedidoCompleto = Omit<PedidoResumo, "itens"> & {
  motivo_rejeicao: string | null;
  aprovado_em: string | null;
  aprovador: { nome: string } | null;
  itens: PedidoItem[];
  historico: {
    id: string;
    status_anterior: StatusPedido | null;
    status_novo: StatusPedido;
    comentario: string | null;
    criado_em: string;
    usuario: { nome: string } | null;
  }[];
  romaneios: { id: string; codigo: string; status: string }[];
};

/** Um pedido com itens, histórico e romaneios. */
export function usePedido(id: string) {
  return useQuery({
    queryKey: ["pedidos", id],
    queryFn: async (): Promise<PedidoCompleto | null> => {
      const { data, error } = await criarClienteNavegador()
        .from("pedidos")
        .select(
          `id, codigo, finalidade, projeto_turma, status, solicitante_id, criado_em, atualizado_em,
           motivo_rejeicao, aprovado_em,
           solicitante:perfis!pedidos_solicitante_id_fkey(nome, turma),
           aprovador:perfis!pedidos_aprovado_por_fkey(nome),
           itens:pedido_itens(id, quantidade_solicitada, quantidade_aprovada, observacao,
             item:itens!pedido_itens_item_id_fkey(id, codigo, nome, unidade, tipo_controle)),
           historico:pedido_historico(id, status_anterior, status_novo, comentario, criado_em,
             usuario:perfis!pedido_historico_usuario_id_fkey(nome)),
           romaneios(id, codigo, status)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        ...data,
        itens: data.itens
          .map((i) => ({
            ...i,
            quantidade_solicitada: Number(i.quantidade_solicitada),
            quantidade_aprovada: i.quantidade_aprovada === null ? null : Number(i.quantidade_aprovada),
          }))
          .sort((a, b) => a.item.nome.localeCompare(b.item.nome, "pt-BR")),
        historico: [...data.historico].sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
      };
    },
  });
}
