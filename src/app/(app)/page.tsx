import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, MapPin, Package, QrCode, ScanLine, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exigirAprovado } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Início" };

/** Cartão de atalho com ícone, título, texto e (opcional) contador. */
function Atalho({ href, Icone, titulo, texto, contador, destaque = false }: {
  href: string; Icone: LucideIcon; titulo: string; texto: string; contador?: string; destaque?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <Card className={`flex h-full items-center gap-4 p-4 transition-colors group-hover:border-primary/50 group-hover:bg-accent ${destaque ? "border-amber-300/60" : ""}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${destaque ? "bg-amber-100 text-amber-900" : "bg-accent text-primary"}`}>
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          <span className="block text-sm text-muted-foreground">{texto}</span>
        </span>
        {contador ? <Badge variant="warning">{contador}</Badge> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </Card>
    </Link>
  );
}

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

  const equipe = perfil.perfil !== "aluno";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Painel</p>
        <h1 className="text-2xl font-semibold md:text-3xl">Olá, {perfil.nome.split(" ")[0]}!</h1>
        <p className="text-sm text-muted-foreground">O que vamos fazer na sala de robótica hoje?</p>
      </div>

      {contagensAbertas > 0 || pendentes > 0 || trocasPendentes > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precisa de atenção</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {contagensAbertas > 0 ? (
              <Atalho href="/contagens" Icone={ScanLine} titulo="Contagem de estoque" texto="Leia o QR das posições e informe o que encontrou." contador={`${contagensAbertas} em andamento`} destaque />
            ) : null}
            {equipe && pendentes > 0 ? (
              <Atalho href="/usuarios" Icone={Users} titulo="Cadastros pendentes" texto="Aprovar acesso de alunos." contador={`${pendentes}`} destaque />
            ) : null}
            {trocasPendentes > 0 ? (
              <Atalho href="/enderecos/trocas" Icone={QrCode} titulo="Trocar etiquetas de QR" texto="Endereços mudaram de lugar." contador={`${trocasPendentes}`} destaque />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atalhos</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Atalho href="/itens" Icone={Package} titulo="Itens" texto="Consultar materiais e saldos." />
          <Atalho href="/pedidos/novo" Icone={ClipboardList} titulo="Novo pedido" texto="Pedir material para um projeto." />
          <Atalho href="/enderecos" Icone={MapPin} titulo="Endereços" texto="Armários, gavetas, caixas e etiquetas." />
          {equipe ? <Atalho href="/usuarios" Icone={Users} titulo="Usuários" texto={`Aprovar alunos${perfil.perfil === "admin" ? " e definir funções" : ""}.`} /> : null}
        </div>
      </section>
    </div>
  );
}
