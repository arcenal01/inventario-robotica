import { useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Enums } from "@/types/database";

export type TipoMovimentacao = Enums<"tipo_movimentacao">;

export const ROTULO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
  emprestimo: "Empréstimo",
  devolucao: "Devolução",
};

export type Posicao = { id: string; codigo: string; nome: string | null };

/** Posições ativas (endereços que guardam itens), em ordem de código. */
export function usePosicoes() {
  return useQuery({
    queryKey: ["posicoes"],
    queryFn: async (): Promise<Posicao[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("enderecos")
        .select("id, codigo, nome, tipo:tipos_endereco!inner(armazena_itens)")
        .eq("ativo", true);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter((e) => e.tipo.armazena_itens)
        .map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
    },
  });
}

export type Pessoa = { id: string; nome: string; turma: string | null; perfil: Enums<"perfil_usuario"> };

/** Usuários aprovados (para empréstimo e recebimento). Só professor/admin enxergam todos. */
export function usePessoasAprovadas() {
  return useQuery({
    queryKey: ["pessoas_aprovadas"],
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("perfis")
        .select("id, nome, turma, perfil")
        .eq("status_cadastro", "aprovado")
        .order("nome");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type Movimentacao = {
  id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
  criado_em: string;
  romaneio_id: string | null;
  contagem_id: string | null;
  item: { codigo: string; nome: string; unidade: string };
  origem: { codigo: string } | null;
  destino: { codigo: string } | null;
  usuario: { nome: string } | null;
};

export type FiltroHistorico = { desde: string | null; tipo: TipoMovimentacao | ""; itemId: string | null };

const LIMITE_HISTORICO = 200;

/** Histórico (ledger) mais recente primeiro. Só professor/admin conseguem ler (RLS). */
export function useMovimentacoes(filtro: FiltroHistorico) {
  return useQuery({
    queryKey: ["movimentacoes", filtro],
    queryFn: async (): Promise<Movimentacao[]> => {
      let consulta = criarClienteNavegador()
        .from("movimentacoes")
        .select(
          `id, tipo, quantidade, motivo, criado_em, romaneio_id, contagem_id,
           item:itens!movimentacoes_item_id_fkey(codigo, nome, unidade),
           origem:enderecos!movimentacoes_endereco_origem_id_fkey(codigo),
           destino:enderecos!movimentacoes_endereco_destino_id_fkey(codigo),
           usuario:perfis!movimentacoes_usuario_id_fkey(nome)`,
        )
        .order("criado_em", { ascending: false })
        .limit(LIMITE_HISTORICO);
      if (filtro.desde) consulta = consulta.gte("criado_em", filtro.desde);
      if (filtro.tipo) consulta = consulta.eq("tipo", filtro.tipo);
      if (filtro.itemId) consulta = consulta.eq("item_id", filtro.itemId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []).map((m) => ({ ...m, quantidade: Number(m.quantidade) }));
    },
  });
}

export { LIMITE_HISTORICO };
