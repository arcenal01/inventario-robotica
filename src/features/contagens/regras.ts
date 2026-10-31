// Regras das contagens usadas pela tela. Sem dependências de tela: testadas em tests/contagens.test.mjs.

export type StatusContagem = "aberta" | "em_andamento" | "em_revisao" | "aprovada" | "cancelada";
export type EscopoContagem = "geral" | "por_endereco" | "por_categoria";

export const ROTULO_STATUS_CONTAGEM: Record<StatusContagem, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

export const COR_STATUS_CONTAGEM: Record<StatusContagem, "default" | "success" | "warning" | "danger"> = {
  aberta: "warning",
  em_andamento: "warning",
  em_revisao: "warning",
  aprovada: "success",
  cancelada: "danger",
};

export const ROTULO_ESCOPO: Record<EscopoContagem, string> = {
  geral: "Estoque inteiro",
  por_endereco: "Endereço",
  por_categoria: "Categoria",
};

export const ABERTAS: StatusContagem[] = ["aberta", "em_andamento", "em_revisao"];

/** Só "aberta" e "em_andamento" recebem contagens (o banco confere em registrar_contagem). */
export function recebeContagens(status: StatusContagem) {
  return status === "aberta" || status === "em_andamento";
}

export type PosicaoContagem = {
  endereco_id: string;
  codigo: string;
  nome: string | null;
  ativo: boolean;
  itens_contados: number;
  itens_faltando: number;
  recontagens: number;
  sem_contagem: boolean;
  contada_por_mim: boolean;
};

export type SituacaoPosicao = "recontar" | "pendente" | "parcial" | "contada" | "vazia";

export const ROTULO_SITUACAO_POSICAO: Record<SituacaoPosicao, string> = {
  recontar: "Recontar",
  pendente: "Pendente",
  parcial: "Parcial",
  contada: "Contada",
  vazia: "Vazia no sistema",
};

export const COR_SITUACAO_POSICAO: Record<SituacaoPosicao, "default" | "success" | "warning" | "danger"> = {
  recontar: "danger",
  pendente: "warning",
  parcial: "warning",
  contada: "success",
  vazia: "default",
};

/** Situação de uma posição na lista. Recontagem tem prioridade; "vazia" = sem saldo e ninguém contou. */
export function situacaoPosicao(p: PosicaoContagem): SituacaoPosicao {
  if (p.recontagens > 0) return "recontar";
  if (p.sem_contagem) return p.itens_faltando > 0 ? "pendente" : "vazia";
  return p.itens_faltando > 0 ? "parcial" : "contada";
}

/** Totais para o resumo do topo (posições vazias não entram no "faltam"). */
export function resumoPosicoes(posicoes: PosicaoContagem[]) {
  const r = { total: posicoes.length, contadas: 0, faltam: 0, recontar: 0, vazias: 0 };
  for (const p of posicoes) {
    const s = situacaoPosicao(p);
    if (s === "contada") r.contadas++;
    else if (s === "recontar") r.recontar++;
    else if (s === "vazia") r.vazias++;
    else r.faltam++;
  }
  return r;
}

/** Agrupa pelo primeiro nível do código (ARM01, EST01...) em ordem natural (P02 antes de P10). */
export function agruparPosicoes<T extends { codigo: string }>(posicoes: T[]): { estrutura: string; posicoes: T[] }[] {
  const ordenadas = [...posicoes].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  const grupos = new Map<string, T[]>();
  for (const p of ordenadas) {
    const raiz = p.codigo.split("-")[0];
    grupos.set(raiz, [...(grupos.get(raiz) ?? []), p]);
  }
  return [...grupos.entries()].map(([estrutura, ps]) => ({ estrutura, posicoes: ps }));
}

/**
 * Encerrar: o banco exige p_forcar quando alguma posição ficou sem nenhuma contagem.
 * Posições vazias no sistema não precisam de aviso; as que têm material sim.
 * Posições parciais: o que ninguém contou vira "não listado" (contado = 0) para revisar.
 */
export function planoEncerramento(posicoes: PosicaoContagem[]) {
  const semContagem = posicoes.filter((p) => p.sem_contagem);
  return {
    forcar: semContagem.length > 0,
    semContagemComMaterial: semContagem.filter((p) => p.itens_faltando > 0).length,
    parciais: posicoes.filter((p) => !p.sem_contagem && p.itens_faltando > 0).length,
    recontagens: posicoes.reduce((s, p) => s + p.recontagens, 0),
  };
}

export type SituacaoItem = "contar" | "contado" | "recontar" | "recontar_outro";

/** Itens que a pessoa pode contar agora nesta posição. */
export function podeContarItem(situacao: string): boolean {
  return situacao === "contar" || situacao === "recontar";
}

/**
 * Tela de contar: valida o que foi digitado e monta o p_itens de registrar_contagem.
 * Campo em branco = não contei agora (o item continua pendente). 0 = procurei e não achei.
 */
export function prepararContagem(linhas: { item_id: string; unidade: string; valor: string }[]):
  | { ok: true; itens: { item_id: string; quantidade: number }[]; emBranco: number }
  | { ok: false; porItem: Record<string, string>; geral?: string } {
  const porItem: Record<string, string> = {};
  const itens: { item_id: string; quantidade: number }[] = [];
  let emBranco = 0;
  for (const l of linhas) {
    const texto = l.valor.trim();
    if (!texto) {
      emBranco++;
      continue;
    }
    const n = Number(texto.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) porItem[l.item_id] = "Informe 0 ou mais";
    else if (n > 999999) porItem[l.item_id] = "Número muito grande";
    else if (l.unidade === "un" && !Number.isInteger(n)) porItem[l.item_id] = 'Em "un" use número inteiro';
    else itens.push({ item_id: l.item_id, quantidade: n });
  }
  if (Object.keys(porItem).length > 0) return { ok: false, porItem };
  if (itens.length === 0) return { ok: false, porItem, geral: "Preencha a quantidade de pelo menos um item (0 se não achou)." };
  return { ok: true, itens, emBranco };
}

type LinhaRodada = { endereco_id: string; item_id: string; rodada: number };

/** Última rodada de cada item em cada posição (o que vale para a revisão e a aprovação). */
export function linhasAtuais<T extends LinhaRodada>(linhas: T[]): T[] {
  const ultima = new Map<string, T>();
  for (const l of linhas) {
    const chave = `${l.endereco_id}|${l.item_id}`;
    const atual = ultima.get(chave);
    if (!atual || l.rodada > atual.rodada) ultima.set(chave, l);
  }
  return [...ultima.values()];
}

/** Divergências que a aprovação vai transformar em ajuste (ainda sem ajuste gerado). */
export function ajustesPrevistos<T extends LinhaRodada & { divergencia: number; ajuste_movimentacao_id: string | null }>(
  linhas: T[],
): T[] {
  return linhasAtuais(linhas).filter((l) => l.divergencia !== 0 && !l.ajuste_movimentacao_id);
}
