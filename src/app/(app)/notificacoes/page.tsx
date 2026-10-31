import type { Metadata } from "next";
import { ListaNotificacoes } from "@/features/notificacoes/lista-notificacoes";
import { exigirAprovado } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Notificações" };

export default async function PaginaNotificacoes() {
  await exigirAprovado();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notificações</h1>
      <ListaNotificacoes />
    </div>
  );
}
