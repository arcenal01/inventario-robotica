import { queryOptions, useQuery } from "@tanstack/react-query";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { EscopoContagem, PosicaoContagem, SituacaoItem, StatusContagem } from "./regras";

export type Contagem = {
  id: string;
  codigo: string;
  escopo: EscopoContagem;
  categoria_id: string | null;
  status: StatusContagem;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  aprovada_em: string | null;
  endereco: { codigo: string; nome: string | null } | null;
  categoria: { nome: string } | null;
  // perfis: aluno só lê o próprio perfil (RLS), então para ele estes nomes vêm nulos
  abertaPor: { nome: string } | null;
  aprovadaPor: { nome: string } | null;
};

const CAMPOS_CONTAGEM = `id, codigo, escopo, categoria_id, status, observacao, criado_em, atualizado_em, aprovada_em,
  endereco:enderecos!contagens_endereco_id_fkey(codigo, nome),
  categoria:categorias!contagens_categoria_id_fkey(nome),
  abertaPor:perfis!contagens_aberta_por_fkey(nome),
  aprovadaPor:perfis!contagens_aprovada_por_fkey(nome)`;

/** Todas as contagens (todos os aprovados veem). Mais recentes primeiro. */
export const consultaContagens = queryOptions({
  queryKey: ["contagens"],
  queryFn: async (): Promise<Contagem[]> => {
    const { data, error } = await criarClienteNavegador()
      .from("contagens")
      .select(CAMPOS_CONTAGEM)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function useContagens() {
  return useQuery(consultaContagens);
}

export function consultaContagem(id: string) {
  return queryOptions({
    queryKey: ["contagens", id],
    queryFn: async (): Promise<Contagem | null> => {
      const { data, error } = await criarClienteNavegador().from("contagens").select(CAMPOS_CONTAGEM).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useContagem(id: string) {
  return useQuery(consultaContagem(id));
}

/** Posições da contagem e a situação de cada uma (função do banco, sem quantidades). */
export function consultaPosicoes(id: string) {
  return queryOptions({
    queryKey: ["contagens", id, "posicoes"],
    queryFn: async (): Promise<PosicaoContagem[]> => {
      const { data, error } = await criarClienteNavegador().rpc("posicoes_da_contagem", { p_contagem_id: id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function usePosicoesDaContagem(id: string) {
  return useQuery(consultaPosicoes(id));
}

export type ItemParaContar = { item_id: string; codigo: string; nome: string; unidade: string; situacao: SituacaoItem };

/** Chave da lista de itens de UMA posição (a preparação offline preenche a mesma chave). */
export function chaveItensParaContar(contagemId: string, enderecoId: string | null) {
  return ["contagens", contagemId, "itens", enderecoId] as const;
}

export function useItensParaContar(contagemId: string, enderecoId: string | null) {
  return useQuery({
    queryKey: chaveItensParaContar(contagemId, enderecoId),
    enabled: enderecoId !== null,
    queryFn: async (): Promise<ItemParaContar[]> => {
      const { data, error } = await criarClienteNavegador().rpc("itens_para_contar", {
        p_contagem_id: contagemId,
        p_endereco_id: enderecoId ?? "",
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((l) => ({ ...l, situacao: l.situacao as SituacaoItem }));
    },
  });
}

/** Itens de TODAS as posições numa chamada (0010), separados por posição. Usado para contar offline. */
export async function carregarItensParaContarTodos(contagemId: string): Promise<Map<string, ItemParaContar[]>> {
  const { data, error } = await criarClienteNavegador().rpc("itens_para_contar_todos", { p_contagem_id: contagemId });
  if (error) throw new Error(error.message);
  const porPosicao = new Map<string, ItemParaContar[]>();
  for (const { endereco_id, ...l } of data ?? []) {
    porPosicao.set(endereco_id, [...(porPosicao.get(endereco_id) ?? []), { ...l, situacao: l.situacao as SituacaoItem }]);
  }
  return porPosicao;
}

export type LinhaContagem = {
  id: string;
  endereco_id: string;
  item_id: string;
  rodada: number;
  quantidade_sistema: number;
  quantidade_contada: number;
  emprestado_em_aberto: number;
  divergencia: number;
  nao_listado: boolean;
  recontagem_pendente: boolean;
  ajuste_movimentacao_id: string | null;
  contado_em: string;
  contado_por: string | null;
  item: { codigo: string; nome: string; unidade: string };
  endereco: { codigo: string };
  contador: { nome: string } | null;
};

/** Linhas contadas (todas as rodadas). Professor/admin veem todas; aluno vê só as próprias (RLS). */
export function useLinhasDaContagem(id: string) {
  return useQuery({
    queryKey: ["contagens", id, "linhas"],
    queryFn: async (): Promise<LinhaContagem[]> => {
      const { data, error } = await criarClienteNavegador()
        .from("contagem_itens")
        .select(
          `id, endereco_id, item_id, rodada, quantidade_sistema, quantidade_contada, emprestado_em_aberto, divergencia,
           nao_listado, recontagem_pendente, ajuste_movimentacao_id, contado_em, contado_por,
           item:itens!contagem_itens_item_id_fkey(codigo, nome, unidade),
           endereco:enderecos!contagem_itens_endereco_id_fkey(codigo),
           contador:perfis!contagem_itens_contado_por_fkey(nome)`,
        )
        .eq("contagem_id", id)
        .order("contado_em");
      if (error) throw new Error(error.message);
      return (data ?? []).map((l) => ({
        ...l,
        quantidade_sistema: Number(l.quantidade_sistema),
        quantidade_contada: Number(l.quantidade_contada),
        emprestado_em_aberto: Number(l.emprestado_em_aberto),
        divergencia: Number(l.divergencia),
      }));
    },
  });
}
