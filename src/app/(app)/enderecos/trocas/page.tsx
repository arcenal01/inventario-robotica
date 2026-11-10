import type { Metadata } from "next";
import Link from "next/link";
import { PainelTrocas } from "@/features/enderecos/painel-trocas";
import { exigirPapel } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Trocas de QR" };

export default async function PaginaTrocasQr() {
  await exigirPapel(["admin", "professor"]);

  return (
    <div className="space-y-4">
      <Link href="/enderecos" className="text-sm text-primary hover:underline">
        Voltar para endereços
      </Link>
      <h1 className="text-2xl font-semibold">Trocas de etiqueta de QR</h1>
      <p className="text-sm text-muted-foreground">
        Quando um endereço muda de lugar, o código dele muda. Imprima as etiquetas novas, troque no estoque e marque como feito.
      </p>
      <PainelTrocas />
    </div>
  );
}
