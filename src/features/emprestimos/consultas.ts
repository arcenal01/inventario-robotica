import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Enums } from "@/types/database";

export type StatusEmprestimo = Enums<"status_emprestimo">;

export const ROTULO_STATUS_EMPRESTIMO: Record<StatusEmprestimo, string> = {
  em_aberto: "Em aberto",
  devolvido_parcial: "Devolvido em parte",
  devolvido: "Devolvido",
  perdido: "Perdido",
};

export type Emprestimo = {
  id: string;
  quantidade: number;
  quantidade_devolvida: number;
  quantidade_perdida: number;
  pendente: number;
  emprestado_em: string;
  prazo_previsto: string | null;
  status: StatusEmprestimo;
  observacao: string | null;
  atualizado_em: string;
  item: { id: string; codigo: string; nome: string; unidade: string };
  pessoa: { id: string; nome: string; turma: string | null } | null;
  origem: { id: string; codigo: string };
};

export type Aba = "abertos" | "encerrados";
const LIMITE_ENCERRADOS = 100;

/** Empréstimos (o aluno só recebe os próprios, pelo RLS). */
export function useEmprestimos(aba: Aba) {
  return useQuery({
    queryKey: ["emprestimos", aba],
    queryFn: async (): Promise<Emprestimo[]> => {
      let consulta = criarClienteNavegador()
        .from("emprestimos")
        .select(
          `id, quantidade, quantidade_devolvida, quantidade_perdida, emprestado_em, prazo_previsto, status,
           observacao, atualizado_em,
           item:itens!emprestimos_item_id_fkey(id, codigo, nome, unidade),
           pessoa:perfis!emprestimos_emprestado_para_fkey(id, nome, turma),
           origem:enderecos!emprestimos_endereco_origem_id_fkey(id, codigo)`,
        );
      consulta =
        aba === "abertos"
          ? consulta.in("status", ["em_aberto", "devolvido_parcial"]).order("emprestado_em")
          : consulta.in("status", ["devolvido", "perdido"]).order("atualizado_em", { ascending: false }).limit(LIMITE_ENCERRADOS);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []).map((e) => {
        const quantidade = Number(e.quantidade);
        const devolvida = Number(e.quantidade_devolvida);
        const perdida = Number(e.quantidade_perdida);
        return {
          ...e,
          quantidade,
          quantidade_devolvida: devolvida,
          quantidade_perdida: perdida,
          pendente: quantidade - devolvida - perdida,
        };
      });
    },
  });
}
