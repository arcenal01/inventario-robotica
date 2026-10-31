import { useQuery } from "@tanstack/react-query";
import type { TipoMovimentacao } from "@/features/estoque/consultas";
import type { StatusEmprestimo } from "@/features/emprestimos/consultas";
import { criarClienteNavegador } from "@/lib/supabase/client";

/** Limite de linhas por relatório (uma sala tem centenas; o limite só protege o celular). */
export const LIMITE_RELATORIO = 5000;

export type LinhaEstoque = {
  quantidade: number;
  endereco: { codigo: string; nome: string | null; ativo: boolean };
  item: { codigo: string; nome: string; unidade: string; tipo_controle: string; categoria: { nome: string } | null };
};

export function useRelatorioEstoque() {
  return useQuery({
    queryKey: ["relatorios", "estoque"],
    queryFn: async (): Promise<LinhaEstoque[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("saldos_por_endereco")
        .select(
          `quantidade_atual,
           endereco:enderecos!inner(codigo, nome, ativo),
           item:itens!inner(codigo, nome, unidade, tipo_controle, categoria:categorias(nome))`,
        )
        .gt("quantidade_atual", 0)
        .limit(LIMITE_RELATORIO);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((l) => ({ quantidade: Number(l.quantidade_atual), endereco: l.endereco, item: l.item }))
        .sort(
          (a, b) =>
            a.endereco.codigo.localeCompare(b.endereco.codigo, "pt-BR", { numeric: true }) ||
            a.item.nome.localeCompare(b.item.nome, "pt-BR"),
        );
    },
  });
}

export type LinhaMovimentacao = {
  id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
  criado_em: string;
  item: { codigo: string; nome: string; unidade: string };
  origem: { codigo: string } | null;
  destino: { codigo: string } | null;
  usuario: { nome: string } | null;
};

/** Movimentações do período (só professor/admin leem o ledger). Mais antigas primeiro, como um extrato. */
export function useRelatorioMovimentacoes(inicio: string, fim: string, tipo: TipoMovimentacao | "") {
  return useQuery({
    queryKey: ["relatorios", "movimentacoes", inicio, fim, tipo],
    enabled: Boolean(inicio && fim), // período inválido: não consulta
    queryFn: async (): Promise<LinhaMovimentacao[]> => {
      let consulta = criarClienteNavegador()
        .from("movimentacoes")
        .select(
          `id, tipo, quantidade, motivo, criado_em,
           item:itens!movimentacoes_item_id_fkey(codigo, nome, unidade),
           origem:enderecos!movimentacoes_endereco_origem_id_fkey(codigo),
           destino:enderecos!movimentacoes_endereco_destino_id_fkey(codigo),
           usuario:perfis!movimentacoes_usuario_id_fkey(nome)`,
        )
        .gte("criado_em", inicio)
        .lte("criado_em", fim)
        .order("criado_em")
        .limit(LIMITE_RELATORIO);
      if (tipo) consulta = consulta.eq("tipo", tipo);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []).map((m) => ({ ...m, quantidade: Number(m.quantidade) }));
    },
  });
}

export type LinhaEmprestimo = {
  id: string;
  quantidade: number;
  quantidade_devolvida: number;
  quantidade_perdida: number;
  pendente: number;
  emprestado_em: string;
  prazo_previsto: string | null;
  status: StatusEmprestimo;
  item: { codigo: string; nome: string; unidade: string };
  pessoa: { nome: string; turma: string | null } | null;
  origem: { codigo: string };
};

export function useRelatorioEmprestimos() {
  return useQuery({
    queryKey: ["relatorios", "emprestimos"],
    queryFn: async (): Promise<LinhaEmprestimo[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("emprestimos")
        .select(
          `id, quantidade, quantidade_devolvida, quantidade_perdida, emprestado_em, prazo_previsto, status,
           item:itens!emprestimos_item_id_fkey(codigo, nome, unidade),
           pessoa:perfis!emprestimos_emprestado_para_fkey(nome, turma),
           origem:enderecos!emprestimos_endereco_origem_id_fkey(codigo)`,
        )
        .order("emprestado_em", { ascending: false })
        .limit(LIMITE_RELATORIO);
      if (error) throw new Error(error.message);
      return (data ?? []).map((e) => {
        const quantidade = Number(e.quantidade);
        const devolvida = Number(e.quantidade_devolvida);
        const perdida = Number(e.quantidade_perdida);
        return { ...e, quantidade, quantidade_devolvida: devolvida, quantidade_perdida: perdida, pendente: quantidade - devolvida - perdida };
      });
    },
  });
}

export type ContagemOpcao = { id: string; codigo: string; status: string; criado_em: string };

export function useContagensParaRelatorio() {
  return useQuery({
    queryKey: ["relatorios", "contagens"],
    queryFn: async (): Promise<ContagemOpcao[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("contagens")
        .select("id, codigo, status, criado_em")
        .neq("status", "cancelada")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type LinhaDivergencia = {
  id: string;
  endereco_codigo: string;
  item_codigo: string;
  item_nome: string;
  rodada: number;
  quantidade_sistema: number;
  quantidade_contada: number;
  divergencia: number;
  emprestado_em_aberto: number;
  nao_listado: boolean;
  ajustado: boolean;
};

/** Última rodada de cada item/posição com diferença (view do Bloco 5). */
export function useRelatorioDivergencias(contagemId: string | null) {
  return useQuery({
    queryKey: ["relatorios", "divergencias", contagemId],
    enabled: contagemId !== null,
    queryFn: async (): Promise<LinhaDivergencia[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("vw_contagem_divergencias")
        .select(
          "id, endereco_codigo, item_codigo, item_nome, rodada, quantidade_sistema, quantidade_contada, divergencia, emprestado_em_aberto, nao_listado, ajuste_movimentacao_id",
        )
        .eq("contagem_id", contagemId ?? "")
        .limit(LIMITE_RELATORIO);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((d) => ({
          id: d.id ?? "",
          endereco_codigo: d.endereco_codigo ?? "",
          item_codigo: d.item_codigo ?? "",
          item_nome: d.item_nome ?? "",
          rodada: d.rodada ?? 1,
          quantidade_sistema: Number(d.quantidade_sistema),
          quantidade_contada: Number(d.quantidade_contada),
          divergencia: Number(d.divergencia),
          emprestado_em_aberto: Number(d.emprestado_em_aberto),
          nao_listado: Boolean(d.nao_listado),
          ajustado: Boolean(d.ajuste_movimentacao_id),
        }))
        .sort(
          (a, b) =>
            a.endereco_codigo.localeCompare(b.endereco_codigo, "pt-BR", { numeric: true }) || a.item_nome.localeCompare(b.item_nome, "pt-BR"),
        );
    },
  });
}
