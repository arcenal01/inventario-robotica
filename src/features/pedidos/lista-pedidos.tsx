"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizar } from "@/features/itens/filtros";
import { formatarDataHora } from "@/lib/datas";
import { usePedidos } from "./consultas";
import { COR_STATUS_PEDIDO, ENCERRADOS, ROTULO_STATUS_PEDIDO, visivelNaLista } from "./regras";

type Aba = "abertos" | "encerrados";

/** Pedidos em aberto e encerrados. A equipe vê os de todos (menos rascunhos alheios); aluno vê os próprios. */
export function ListaPedidos({ usuarioId, equipe }: { usuarioId: string; equipe: boolean }) {
  const pedidosQ = usePedidos();
  const [aba, setAba] = useState<Aba>("abertos");
  const [busca, setBusca] = useState("");
  const [soAguardando, setSoAguardando] = useState(false);

  const visiveis = useMemo(() => (pedidosQ.data ?? []).filter((p) => visivelNaLista(p, usuarioId)), [pedidosQ.data, usuarioId]);
  const aguardando = visiveis.filter((p) => p.status === "enviado").length;
  const lista = useMemo(() => {
    const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
    return visiveis.filter((p) => {
      if ((aba === "encerrados") !== ENCERRADOS.includes(p.status)) return false;
      if (soAguardando && p.status !== "enviado") return false;
      const alvo = normalizar(`${p.codigo} ${p.finalidade} ${p.projeto_turma ?? ""} ${p.solicitante?.nome ?? ""} ${p.solicitante?.turma ?? ""}`);
      return palavras.every((w) => alvo.includes(w));
    });
  }, [visiveis, aba, busca, soAguardando]);

  return (
    <div className="space-y-4">
      <Link
        href="/pedidos/novo"
        className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Novo pedido
      </Link>

      {equipe && aguardando > 0 && !soAguardando ? (
        <button
          type="button"
          onClick={() => {
            setAba("abertos");
            setSoAguardando(true);
          }}
          className="w-full rounded-md bg-amber-50 p-3 text-left text-sm text-amber-900 hover:bg-amber-100"
        >
          {aguardando === 1 ? "1 pedido aguarda" : `${aguardando} pedidos aguardam`} aprovação. Toque para ver.
        </button>
      ) : null}

      <div className="flex gap-2" role="tablist">
        {(["abertos", "encerrados"] as const).map((a) => (
          <Button
            key={a}
            role="tab"
            aria-selected={aba === a}
            size="sm"
            variant={aba === a ? "default" : "outline"}
            onClick={() => {
              setAba(a);
              setSoAguardando(false);
            }}
          >
            {a === "abertos" ? "Em andamento" : "Encerrados"}
          </Button>
        ))}
      </div>

      <Input
        type="search"
        aria-label="Buscar pedidos"
        placeholder={equipe ? "Buscar por código, finalidade, aluno ou turma" : "Buscar por código ou finalidade"}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {soAguardando ? (
        <Button variant="ghost" size="sm" onClick={() => setSoAguardando(false)}>
          Mostrar todos em andamento
        </Button>
      ) : null}

      {pedidosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando pedidos...</p> : null}
      {pedidosQ.isError ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Não foi possível carregar os pedidos: {pedidosQ.error.message}
        </p>
      ) : null}
      {pedidosQ.data && lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido.</p> : null}

      <ul className="space-y-2">
        {lista.map((p) => (
          <li key={p.id}>
            <Link href={`/pedidos/${p.id}`} className="block">
              <Card className="pressionar-suave hover:bg-accent">
                <CardContent className="space-y-1 p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-semibold">{p.codigo}</span>
                    <Badge variant={COR_STATUS_PEDIDO[p.status]}>{ROTULO_STATUS_PEDIDO[p.status]}</Badge>
                  </div>
                  <p className="truncate text-sm">{p.finalidade}</p>
                  <p className="text-xs text-muted-foreground">
                    {equipe ? `${p.solicitante?.nome ?? "?"}${p.solicitante?.turma ? ` · ${p.solicitante.turma}` : ""} · ` : ""}
                    {p.itens[0]?.count === 1 ? "1 item" : `${p.itens[0]?.count ?? 0} itens`} · {formatarDataHora(p.atualizado_em)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
