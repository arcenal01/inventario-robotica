import type { Metadata } from "next";
import { PainelEmprestimos } from "@/features/emprestimos/painel-emprestimos";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Empréstimos" };

export default async function PaginaEmprestimos() {
  const perfil = await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{perfil.perfil === "aluno" ? "Meus empréstimos" : "Empréstimos"}</h1>
      <PainelEmprestimos papel={perfil.perfil} />
    </div>
  );
}
