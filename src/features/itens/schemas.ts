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

/** Prefixo do código: 2 a 5 letras sem acento (ALI, CHAV). Igual à regra do banco (migration 0011). */
export const REGEX_PREFIXO = /^[A-Z]{2,5}$/;

/** Código completo do item: ALI-001 ... ALI-999, depois ALI-1000 (sem zeros sobrando). */
export const REGEX_CODIGO_ITEM = /^[A-Z]{2,5}-(?:\d{3}|[1-9]\d{3,})$/;

export const esquemaItem = z
  .object({
    // Só no cadastro. Vazio = prefixo da categoria (SEN-001); preenchido = prefixo próprio (ALI-001)
    prefixo_codigo: z
      .string()
      .trim()
      .toUpperCase()
      .refine((p) => p === "" || REGEX_PREFIXO.test(p), "Use de 2 a 5 letras, sem números nem acentos")
      .optional()
      .default(""),
    nome: z.string().trim().min(2, "Informe o nome").max(80, "Máximo 80 caracteres"),
    categoria_id: z.string().min(1, "Escolha a categoria"),
    unidade: z.enum(UNIDADES),
    tipo_controle: z.enum(TIPOS_CONTROLE),
    descricao: z.string().trim().max(500, "Máximo 500 caracteres"),
    // true = quando acabar, avisa para repor; false = "não terá mais no estoque"
    repor: z.boolean().optional().default(true),
    especificacoes: z.array(especificacao).max(20, "Máximo 20 especificações"),
    ativo: z.boolean(),
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
    .regex(REGEX_PREFIXO, "Use de 2 a 5 letras, sem números nem acentos"),
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
