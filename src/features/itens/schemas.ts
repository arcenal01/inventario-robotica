import { z } from "zod";

export const UNIDADES = ["un", "m", "kg"] as const;
export const TIPOS_CONTROLE = ["consumivel", "emprestavel"] as const;

export const ROTULO_UNIDADE: Record<(typeof UNIDADES)[number], string> = {
  un: "Unidade (un)",
  m: "Metro (m)",
  kg: "Quilo (kg)",
};

export const ROTULO_TIPO_CONTROLE: Record<(typeof TIPOS_CONTROLE)[number], string> = {
  consumivel: "Consumível (sai e não volta)",
  emprestavel: "Emprestável (sai e volta)",
};

const especificacao = z.object({
  chave: z.string().trim().min(1, "Informe o nome").max(40, "Máximo 40 caracteres"),
  valor: z.string().trim().min(1, "Informe o valor").max(120, "Máximo 120 caracteres"),
});

export const esquemaItem = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome").max(80, "Máximo 80 caracteres"),
    categoria_id: z.string().min(1, "Escolha a categoria"),
    unidade: z.enum(UNIDADES),
    tipo_controle: z.enum(TIPOS_CONTROLE),
    descricao: z.string().trim().max(500, "Máximo 500 caracteres"),
    estoque_minimo: z
      .number({ invalid_type_error: "Informe um número" })
      .min(0, "Não pode ser negativo")
      .max(999999, "Número muito grande"),
    especificacoes: z.array(especificacao).max(20, "Máximo 20 especificações"),
    ativo: z.boolean(),
  })
  .refine((d) => d.unidade !== "un" || Number.isInteger(d.estoque_minimo), {
    message: 'Em "un" o estoque mínimo precisa ser inteiro',
    path: ["estoque_minimo"],
  })
  .refine((d) => new Set(d.especificacoes.map((e) => e.chave.toLowerCase())).size === d.especificacoes.length, {
    message: "Há especificações com o mesmo nome",
    path: ["especificacoes"],
  });

export const esquemaCategoria = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(40, "Máximo 40 caracteres"),
  prefixo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, "Use de 2 a 5 letras, sem números nem acentos"),
});

export type DadosItem = z.infer<typeof esquemaItem>;
export type DadosCategoria = z.infer<typeof esquemaCategoria>;
export type Especificacao = z.infer<typeof especificacao>;

/** Lista de especificações (formulário) -> objeto JSON gravado em itens.especificacoes. */
export function especificacoesParaJson(lista: Especificacao[]): Record<string, string> {
  return Object.fromEntries(lista.map((e) => [e.chave.trim(), e.valor.trim()]));
}

/** Objeto JSON do banco -> lista para o formulário (ignora valores que não são texto/número). */
export function jsonParaEspecificacoes(json: unknown): Especificacao[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, unknown>)
    .filter(([, valor]) => typeof valor === "string" || typeof valor === "number")
    .map(([chave, valor]) => ({ chave, valor: String(valor) }));
}
