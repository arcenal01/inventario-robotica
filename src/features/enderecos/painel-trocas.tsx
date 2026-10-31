"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Troca = {
  id: string;
  motivo: string | null;
  status: "pendente" | "concluida";
  criado_em: string;
  concluida_em: string | null;
  etiquetas: { codigo_antigo: string; codigo_novo: string; nome: string | null; tipo_nome: string }[];
};

async function carregarTrocas(): Promise<Troca[]> {
  const supabase = criarClienteNavegador();
  const { data: trocas, error } = await supabase
    .from("trocas_qr")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  if (!trocas || trocas.length === 0) return [];

  const { data: linhas, error: erroLinhas } = await supabase
    .from("vw_troca_qr_etiquetas")
    .select("*")
    .in(
      "troca_id",
      trocas.map((t) => t.id),
    )
    .order("codigo_novo");
  if (erroLinhas) throw new Error(erroLinhas.message);

  return trocas.map((t) => ({
    id: t.id,
    motivo: t.motivo,
    status: t.status,
    criado_em: t.criado_em,
    concluida_em: t.concluida_em,
    etiquetas: (linhas ?? [])
      .filter((l) => l.troca_id === t.id)
      .map((l) => ({
        codigo_antigo: l.codigo_antigo ?? "",
        codigo_novo: l.codigo_novo ?? "",
        nome: l.nome,
        tipo_nome: l.tipo_nome ?? "",
      })),
  }));
}

function CartaoTroca({ troca, aoConcluir, ocupado }: { troca: Troca; aoConcluir: () => void; ocupado: boolean }) {
  const pendente = troca.status === "pendente";
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">
              {new Date(troca.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              {troca.motivo ? ` · ${troca.motivo}` : ""}
            </p>
          </div>
          <Badge variant={pendente ? "warning" : "success"}>{pendente ? "Pendente" : "Concluída"}</Badge>
        </div>

        <ul className="space-y-1 text-sm">
          {troca.etiquetas.map((e) => (
            <li key={e.codigo_novo} className="flex flex-wrap items-center gap-x-2">
              <span className="font-mono text-muted-foreground line-through">{e.codigo_antigo}</span>
              <span aria-hidden>→</span>
              <span className="font-mono font-semibold">{e.codigo_novo}</span>
              {e.nome ? <span className="text-muted-foreground">{e.nome}</span> : null}
            </li>
          ))}
        </ul>

        {pendente ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/enderecos/etiquetas?troca=${troca.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Imprimir etiquetas novas
            </Link>
            <Button size="sm" disabled={ocupado} onClick={aoConcluir}>
              Etiquetas trocadas
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Requisições de troca de QR: o que precisa ser trocado fisicamente no estoque. */
export function PainelTrocas() {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const consulta = useQuery({ queryKey: ["trocas_qr", "lista"], queryFn: carregarTrocas });

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await criarClienteNavegador().rpc("concluir_troca_qr", { p_troca_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trocas_qr"] }),
    onError: (e) => setErro(e.message),
  });

  if (consulta.isPending) return <p className="text-sm text-muted-foreground">Carregando trocas...</p>;
  if (consulta.isError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar: {consulta.error.message}
      </p>
    );
  }

  const pendentes = consulta.data.filter((t) => t.status === "pendente");
  const concluidas = consulta.data.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-6">
      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="titulo-pendentes">
        <h2 id="titulo-pendentes" className="text-lg font-semibold">
          Pendentes ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etiqueta para trocar.</p>
        ) : (
          pendentes.map((t) => (
            <CartaoTroca
              key={t.id}
              troca={t}
              ocupado={concluir.isPending && concluir.variables === t.id}
              aoConcluir={() => {
                setErro(null);
                concluir.mutate(t.id);
              }}
            />
          ))
        )}
      </section>

      {concluidas.length > 0 ? (
        <details className="space-y-3">
          <summary className="cursor-pointer text-lg font-semibold">Concluídas ({concluidas.length})</summary>
          <div className="mt-3 space-y-3">
            {concluidas.map((t) => (
              <CartaoTroca key={t.id} troca={t} ocupado={false} aoConcluir={() => undefined} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
