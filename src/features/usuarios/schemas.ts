import { z } from "zod";

/** O que a tela de usuários pode mudar em um perfil. O banco (trigger + RLS) valida de novo. */
export const esquemaAlteracaoPerfil = z
  .object({
    status_cadastro: z.enum(["pendente", "aprovado", "rejeitado", "bloqueado"]).optional(),
    perfil: z.enum(["admin", "professor", "aluno"]).optional(),
  })
  .strict()
  .refine((d) => d.status_cadastro !== undefined || d.perfil !== undefined, {
    message: "Nada para alterar",
  });

export type AlteracaoPerfil = z.infer<typeof esquemaAlteracaoPerfil>;
