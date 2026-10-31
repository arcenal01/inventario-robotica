// Regras dos romaneios usadas pela tela. Sem dependências de tela: testadas em tests/romaneios.test.mjs.

export type StatusRomaneio = "gerado" | "em_separacao" | "separado" | "entregue" | "cancelado";

export const ROTULO_STATUS_ROMANEIO: Record<StatusRomaneio, string> = {
  gerado: "Gerado",
  em_separacao: "Em separação",
  separado: "Separado (pronto para entregar)",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const COR_STATUS_ROMANEIO: Record<StatusRomaneio, "default" | "success" | "warning" | "danger"> = {
  gerado: "warning",
  em_separacao: "warning",
  separado: "success",
  entregue: "default",
  cancelado: "danger",
};

export const ABERTOS: StatusRomaneio[] = ["gerado", "em_separacao", "separado"];

export function podeSeparar(status: StatusRomaneio) {
  return status === "gerado" || status === "em_separacao";
}

export function podeCancelar(status: StatusRomaneio) {
  return status !== "entregue" && status !== "cancelado";
}

type LinhaComLocal = { endereco: { codigo: string }; item: { nome: string } };

/** Ordem da separação: pelo código do endereço (ARM01-GAV01-P02 antes de ARM01-GAV01-P10), depois pelo nome. */
export function ordenarPorLocal<T extends LinhaComLocal>(linhas: T[]): T[] {
  return [...linhas].sort(
    (a, b) =>
      a.endereco.codigo.localeCompare(b.endereco.codigo, "pt-BR", { numeric: true }) ||
      a.item.nome.localeCompare(b.item.nome, "pt-BR"),
  );
}

/** Agrupa as linhas pelo primeiro nível do endereço (ex.: ARM01), para o separador andar menos. */
export function agruparPorEstrutura<T extends LinhaComLocal>(linhas: T[]): { estrutura: string; linhas: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const l of ordenarPorLocal(linhas)) {
    const raiz = l.endereco.codigo.split("-")[0];
    grupos.set(raiz, [...(grupos.get(raiz) ?? []), l]);
  }
  return [...grupos.entries()].map(([estrutura, ls]) => ({ estrutura, linhas: ls }));
}

/** Conferência da entrega: valida cada linha (0 até o separado) e monta o JSON de entregar_romaneio. */
export function prepararConferencia(
  linhas: { id: string; quantidade: number; conferida: string; unidade: string }[],
):
  | { ok: true; conferencias: { romaneio_item_id: string; quantidade_conferida: number }[]; total: number }
  | { ok: false; porLinha: Record<string, string>; geral?: string } {
  const porLinha: Record<string, string> = {};
  const conferencias = linhas.map((l) => {
    const n = Number(l.conferida.replace(",", "."));
    if (!l.conferida.trim() || !Number.isFinite(n) || n < 0) porLinha[l.id] = "Informe 0 ou mais";
    else if (n > l.quantidade) porLinha[l.id] = `Máximo ${l.quantidade}`;
    else if (l.unidade === "un" && !Number.isInteger(n)) porLinha[l.id] = 'Em "un" use número inteiro';
    return { romaneio_item_id: l.id, quantidade_conferida: n };
  });
  if (Object.keys(porLinha).length > 0) return { ok: false, porLinha };
  const total = conferencias.reduce((s, c) => s + c.quantidade_conferida, 0);
  if (total <= 0) return { ok: false, porLinha, geral: "Nada conferido para entregar" };
  return { ok: true, conferencias, total };
}
