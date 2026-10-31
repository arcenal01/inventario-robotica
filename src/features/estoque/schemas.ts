import { z } from "zod";

const quantidade = z
  .number({ invalid_type_error: "Informe a quantidade" })
  .positive("A quantidade precisa ser maior que zero")
  .max(999999, "Número muito grande");

const motivo = z.string().trim().max(200, "Máximo 200 caracteres");

export const esquemaEntrada = z.object({ destino: z.string().min(1, "Escolha a posição"), quantidade, motivo });
export const esquemaSaida = z.object({ origem: z.string().min(1, "Escolha de onde sai"), quantidade, motivo });
export const esquemaTransferencia = z
  .object({
    origem: z.string().min(1, "Escolha de onde sai"),
    destino: z.string().min(1, "Escolha para onde vai"),
    quantidade,
    motivo,
  })
  .refine((d) => d.origem !== d.destino, { message: "Origem e destino precisam ser diferentes", path: ["destino"] });
export const esquemaAjuste = z.object({
  endereco: z.string().min(1, "Escolha a posição"),
  quantidade_nova: z
    .number({ invalid_type_error: "Informe a quantidade contada" })
    .min(0, "Não pode ser negativa")
    .max(999999, "Número muito grande"),
  motivo: motivo.min(3, "Explique o motivo do ajuste"),
});

/** Em "un" a quantidade precisa ser inteira (o banco também confere). */
export function quantidadeValida(valor: number, unidade: string): string | null {
  if (unidade === "un" && !Number.isInteger(valor)) return 'Em "un" use número inteiro';
  return null;
}
