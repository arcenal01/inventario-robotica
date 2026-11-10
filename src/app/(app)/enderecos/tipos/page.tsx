import type { Metadata } from "next";
import Link from "next/link";
import { PainelTipos } from "@/features/enderecos/painel-tipos";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Tipos de endereço" };

export default async function PaginaTiposEndereco() {
  await exigirPapel(["admin"]);

  return (
    <div className="space-y-4">
      <Link href="/enderecos" className="text-sm text-primary hover:underline">
        Voltar para endereços
      </Link>
      <h1 className="text-2xl font-semibold">Tipos de endereço</h1>
      <PainelTipos />
    </div>
  );
}
