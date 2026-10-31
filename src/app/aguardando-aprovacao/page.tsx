import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BotaoAtualizar } from "@/features/auth/botao-atualizar";
import { obterUsuarioEPerfil } from "@/lib/auth/perfil";
import type { StatusCadastro } from "@/types";

export const metadata: Metadata = { title: "Aguardando aprovação" };

const TEXTOS: Record<StatusCadastro | "sem_perfil", { titulo: string; descricao: string }> = {
  pendente: {
    titulo: "Cadastro enviado",
    descricao: "Um professor ou o administrador precisa aprovar seu acesso. Volte aqui depois e toque em verificar de novo.",
  },
  rejeitado: {
    titulo: "Cadastro não aprovado",
    descricao: "Seu cadastro não foi aprovado. Fale com um professor ou com o administrador.",
  },
  bloqueado: {
    titulo: "Acesso bloqueado",
    descricao: "Seu acesso está bloqueado. Fale com um professor ou com o administrador.",
  },
  aprovado: { titulo: "Cadastro aprovado", descricao: "Tudo certo." },
  sem_perfil: {
    titulo: "Cadastro não encontrado",
    descricao: "Não encontramos seu cadastro. Saia e tente criar a conta de novo, ou fale com o administrador.",
  },
};

export default async function PaginaAguardandoAprovacao() {
  const { user, perfil } = await obterUsuarioEPerfil();
  if (!user) redirect("/entrar");
  if (perfil?.status_cadastro === "aprovado") redirect("/");

  const texto = TEXTOS[perfil?.status_cadastro ?? "sem_perfil"];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">{texto.titulo}</CardTitle>
          <CardDescription>{texto.descricao}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <BotaoAtualizar />
          <form action="/sair" method="post">
            <Button type="submit" variant="ghost" className="w-full">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
