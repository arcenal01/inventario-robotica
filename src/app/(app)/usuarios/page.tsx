import type { Metadata } from "next";
import { PainelUsuarios } from "@/features/usuarios/painel-usuarios";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Usuários" };

export default async function PaginaUsuarios() {
  // Aluno que digitar /usuarios na barra de endereço volta para o início.
  const perfil = await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <PainelUsuarios eu={{ id: perfil.id, perfil: perfil.perfil }} />
    </div>
  );
}
