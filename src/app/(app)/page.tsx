import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAprovado } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Início" };

export default async function PaginaInicio() {
  const perfil = await exigirAprovado();
  const supabase = await criarClienteServidor();

  // Contagens recebendo contagens: todos podem participar
  const { count: contagens } = await supabase
    .from("contagens")
    .select("id", { count: "exact", head: true })
    .in("status", ["aberta", "em_andamento"]);
  const contagensAbertas = contagens ?? 0;

  let pendentes = 0;
  let trocasPendentes = 0;
  if (perfil.perfil !== "aluno") {
    const { count } = await supabase
      .from("perfis")
      .select("id", { count: "exact", head: true })
      .eq("status_cadastro", "pendente");
    pendentes = count ?? 0;

    const { count: trocas } = await supabase
      .from("trocas_qr")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    trocasPendentes = trocas ?? 0;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Olá, {perfil.nome.split(" ")[0]}!</h1>

      {perfil.perfil !== "aluno" ? (
        <Link href="/usuarios" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Aprovar cadastros de alunos{perfil.perfil === "admin" ? " e definir funções" : ""}.</CardDescription>
              </div>
              {pendentes > 0 ? <Badge variant="warning">{pendentes} pendente(s)</Badge> : null}
            </CardHeader>
          </Card>
        </Link>
      ) : null}

      {trocasPendentes > 0 ? (
        <Link href="/enderecos/trocas" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Trocar etiquetas de QR</CardTitle>
                <CardDescription>Endereços mudaram de lugar e as etiquetas precisam ser trocadas no estoque.</CardDescription>
              </div>
              <Badge variant="warning">{trocasPendentes} pendente(s)</Badge>
            </CardHeader>
          </Card>
        </Link>
      ) : null}

      {contagensAbertas > 0 ? (
        <Link href="/contagens" className="block">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Contagem de estoque</CardTitle>
                <CardDescription>Leia o QR das posições e informe o que encontrou.</CardDescription>
              </div>
              <Badge variant="warning">{contagensAbertas} em andamento</Badge>
            </CardHeader>
          </Card>
        </Link>
      ) : null}

      <Link href="/enderecos" className="block">
        <Card className="transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle>Endereços</CardTitle>
            <CardDescription>Armários, gavetas, caixas e posições, com etiquetas de QR.</CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Painel e relatórios chegam no próximo bloco.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Já funcionam: cadastros e aprovação, endereços com QR, itens, movimentações, empréstimos, pedidos, romaneios e contagens.
        </CardContent>
      </Card>
    </div>
  );
}
