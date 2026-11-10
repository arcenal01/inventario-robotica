import type { Metadata } from "next";
import { ListaRomaneios } from "@/features/romaneios/lista-romaneios";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Romaneios" };

export default async function PaginaRomaneios() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Romaneios</h1>
      <ListaRomaneios />
    </div>
  );
}
