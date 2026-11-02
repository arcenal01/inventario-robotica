// Regras do uso offline (Bloco 15A), sem React e sem banco: testadas em tests/offline.test.mjs.

/** Envio guardado no aparelho para mandar quando a conexão voltar. Por enquanto só contagem (escolha do usuário). */
export type EnvioFila = {
  chave: string; // a mesma chave de idempotência enviada ao banco: reenviar nunca conta duas vezes
  tipo: "contagem";
  contagemId: string;
  contagemCodigo: string;
  enderecoId: string;
  enderecoCodigo: string;
  itens: { item_id: string; quantidade: number }[];
  criadoEm: number;
  estado: "pendente" | "recusado";
  motivo: string | null; // por que o servidor recusou (estado "recusado")
  tentativas: number;
};

/** Consultas guardadas no aparelho para abrir sem conexão: itens, saldos, endereços e contagens. */
const RAIZES_GUARDADAS = new Set(["itens", "categorias", "enderecos", "tipos_endereco", "saldos", "contagens"]);

export function deveGuardar(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && RAIZES_GUARDADAS.has(queryKey[0]);
}

/** Texto único para a chave da consulta (é a chave da tabela no IndexedDB). */
export function textoDaChave(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}

/**
 * Falha que vale tentar de novo depois (rede, servidor fora, sessão vencida)? Ou recusa de verdade do banco
 * (ex.: "contagem não está recebendo contagens")? Recusa vai para a lista de recusados; falha temporária fica na fila.
 */
export function eFalhaTemporaria(status: number | undefined, mensagem: string | null | undefined): boolean {
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(mensagem ?? "")) return true;
  if (status === undefined || status === 0) return true; // nem chegou ao servidor
  return status >= 500 || status === 401 || status === 408 || status === 429;
}

/** Quantos envios esperam conexão e quantos foram recusados. */
export function resumoFila(fila: Pick<EnvioFila, "estado">[]) {
  const pendentes = fila.filter((e) => e.estado === "pendente").length;
  return { pendentes, recusados: fila.length - pendentes };
}

/**
 * Itens da posição já guardados na fila deste aparelho (ainda não enviados): a tela mostra como "na fila"
 * para a pessoa não contar de novo antes de enviar.
 */
export function itensNaFila(fila: EnvioFila[], contagemId: string, enderecoId: string | null): Set<string> {
  const ids = new Set<string>();
  for (const e of fila) {
    if (e.estado === "pendente" && e.contagemId === contagemId && e.enderecoId === enderecoId) {
      for (const i of e.itens) ids.add(i.item_id);
    }
  }
  return ids;
}

/** Texto de "dados de quando": hoje mostra só a hora; outro dia mostra a data também (horário do aparelho). */
export function descreverAtualizacao(quando: number, agora: number = Date.now()): string {
  const d = new Date(quando);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return new Date(agora).toDateString() === d.toDateString() ? `hoje às ${hora}` : `${d.toLocaleDateString("pt-BR")} às ${hora}`;
}

// ---------------------------------------------------------------------
// Bloco 15B: pendências (contagens recusadas pelo servidor)
// ---------------------------------------------------------------------

export type DicaRecusa = {
  /** Explicação simples do que aconteceu e do que fazer. */
  texto: string;
  /** Faz sentido corrigir (tirar/alterar itens) e reenviar? Se não, o caminho é descartar. */
  podeCorrigir: boolean;
  /** Código do item citado no motivo (ex.: SEN-002), para destacar na correção. */
  codigoItem: string | null;
};

/** Transforma o motivo da recusa (mensagem do banco) numa dica do que fazer. */
export function dicaRecusa(motivo: string | null | undefined): DicaRecusa {
  const m = motivo ?? "";
  const codigoItem = /\b([A-Z][A-Z0-9]*-\d{3,})\b/.exec(m)?.[1] ?? null;
  const dica = (texto: string, podeCorrigir: boolean): DicaRecusa => ({ texto, podeCorrigir, codigoItem });
  if (/não está recebendo contagens|contagem não encontrada/i.test(m)) {
    return dica("A contagem já foi encerrada ou cancelada pelo professor. Não dá mais para enviar: descarte e, se precisar, avise o professor.", false);
  }
  if (/não faz parte desta contagem/i.test(m)) {
    return dica("Esta posição não faz parte da contagem (a etiqueta pode ter sido trocada). Descarte e conte de novo pela etiqueta atual.", false);
  }
  if (/já foi contado neste endereço/i.test(m)) {
    return dica("Outra pessoa já contou este item nesta posição antes de você enviar. Tire o item e envie o resto.", true);
  }
  if (/recontagem .* outra pessoa/i.test(m)) {
    return dica("A recontagem deste item precisa ser feita por outra pessoa. Tire o item e envie o resto.", true);
  }
  if (/não pertence à categoria/i.test(m)) {
    return dica("Este item não é da categoria desta contagem. Tire o item e envie o resto.", true);
  }
  if (/sem permissão/i.test(m)) {
    return dica("Seu cadastro estava sem permissão nesse momento. Tente de novo; se continuar, fale com o professor.", false);
  }
  return dica("Confira as quantidades, corrija ou tire o item com problema e envie de novo. Se não der, descarte.", true);
}
