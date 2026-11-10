import { z } from "zod";

const textoOpcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres`);

export const esquemaNovoEndereco = z.object({
  tipo_endereco_id: z.string().min(1, "Escolha o tipo"),
  nome: textoOpcional(60),
  descricao: textoOpcional(200),
  quantidade: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(50, "Máximo 50 de cada vez"),
});

export const esquemaEditarEndereco = z.object({
  nome: textoOpcional(60),
  descricao: textoOpcional(200),
});

export const esquemaMoverEndereco = z.object({
  novo_pai_id: z.string().min(1, "Escolha o destino"),
  motivo: textoOpcional(120),
});

export const esquemaTipoEndereco = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(30, "Máximo 30 caracteres"),
  prefixo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,5}$/, "Use de 1 a 5 letras, sem números nem acentos"),
  nivel: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(9, "Máximo 9"),
  armazena_itens: z.boolean(),
});

/** Resposta da função mover_endereco (o banco devolve JSON). */
export const esquemaResultadoMover = z.object({
  troca_id: z.string(),
  codigo_antigo: z.string(),
  codigo_novo: z.string(),
  etiquetas: z.number(),
});

export type DadosNovoEndereco = z.infer<typeof esquemaNovoEndereco>;
export type DadosEditarEndereco = z.infer<typeof esquemaEditarEndereco>;
export type DadosMoverEndereco = z.infer<typeof esquemaMoverEndereco>;
export type DadosTipoEndereco = z.infer<typeof esquemaTipoEndereco>;
