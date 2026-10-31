import type { PapelUsuario } from "@/types";

export type ItemNavegacao = {
  href: string;
  rotulo: string;
  papeis: PapelUsuario[];
};

/** Menu do app. Cada bloco de tela novo (8 a 13) acrescenta uma linha aqui. */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { href: "/", rotulo: "Início", papeis: ["admin", "professor", "aluno"] },
  { href: "/enderecos", rotulo: "Endereços", papeis: ["admin", "professor", "aluno"] },
  { href: "/usuarios", rotulo: "Usuários", papeis: ["admin", "professor"] },
];

export function itensParaPapel(papel: PapelUsuario): ItemNavegacao[] {
  return ITENS_NAVEGACAO.filter((item) => item.papeis.includes(papel));
}
