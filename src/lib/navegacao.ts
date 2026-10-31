import type { PapelUsuario } from "@/types";

export type ItemNavegacao = {
  href: string;
  rotulo: string;
  papeis: PapelUsuario[];
  /** Aparece na barra de baixo do celular (as outras ficam em "Mais"). */
  principal?: boolean;
};

const TODOS: PapelUsuario[] = ["admin", "professor", "aluno"];
const EQUIPE: PapelUsuario[] = ["admin", "professor"];

/** Menu do app. Cada bloco de tela novo (8 a 13) acrescenta uma linha aqui. */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { href: "/", rotulo: "Início", papeis: TODOS, principal: true },
  { href: "/itens", rotulo: "Itens", papeis: TODOS, principal: true },
  { href: "/emprestimos", rotulo: "Empréstimos", papeis: TODOS, principal: true },
  { href: "/movimentacoes", rotulo: "Movimentações", papeis: EQUIPE },
  { href: "/enderecos", rotulo: "Endereços", papeis: TODOS },
  { href: "/usuarios", rotulo: "Usuários", papeis: EQUIPE },
];

export function itensParaPapel(papel: PapelUsuario): ItemNavegacao[] {
  return ITENS_NAVEGACAO.filter((item) => item.papeis.includes(papel));
}
