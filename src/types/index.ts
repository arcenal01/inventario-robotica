import type { Enums, Tables } from "./database";

export type Perfil = Tables<"perfis">;
export type PapelUsuario = Enums<"perfil_usuario">;
export type StatusCadastro = Enums<"status_cadastro">;

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  admin: "Administrador",
  professor: "Professor",
  aluno: "Aluno",
};

export const ROTULO_STATUS: Record<StatusCadastro, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  bloqueado: "Bloqueado",
};
