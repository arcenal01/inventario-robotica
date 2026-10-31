import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioCadastro } from "@/features/auth/formulario-cadastro";

export const metadata: Metadata = { title: "Cadastro" };

export default function PaginaCadastro() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Criar conta</CardTitle>
          <CardDescription>Depois do cadastro, um professor ou o administrador precisa aprovar seu acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioCadastro />
        </CardContent>
      </Card>
    </main>
  );
}
