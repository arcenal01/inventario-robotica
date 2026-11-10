import { z } from "zod";

const email = z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido");

export const esquemaEntrar = z.object({
  email,
  senha: z.string().min(1, "Informe a senha"),
});

export const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo").max(80, "Nome muito longo"),
    email,
    // Opcional (professores usam o mesmo cadastro); vazio vira undefined
    turma: z
      .string()
      .trim()
      .max(30, "Turma muito longa")
      .optional()
      .transform((t) => (t ? t : undefined)),
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(72, "Senha muito longa"),
    confirmarSenha: z.string().min(1, "Repita a senha"),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não conferem",
    path: ["confirmarSenha"],
  });

export type DadosEntrar = z.infer<typeof esquemaEntrar>;
export type DadosCadastro = z.output<typeof esquemaCadastro>;
export type EntradaCadastro = z.input<typeof esquemaCadastro>;
