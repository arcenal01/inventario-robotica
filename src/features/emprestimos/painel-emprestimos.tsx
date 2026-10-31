"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatarQuantidade } from "@/features/itens/filtros";
import { formatarData, formatarDataHora, hojeBrasilia } from "@/lib/datas";
import { cn } from "@/lib/utils";
import type { PapelUsuario } from "@/types";
import { ROTULO_STATUS_EMPRESTIMO, useEmprestimos, type Aba, type Emprestimo } from "./consultas";
import { DialogoDevolucao, DialogoNovoEmprestimo, DialogoPerda } from "./dialogos";
import { filtrarEmprestimos, ordenarAbertos, situacaoEmprestimo } from "./situacao";

type Janela = { tipo: "novo" } | { tipo: "devolver" | "perder"; emprestimo: Emprestimo } | null;

function CartaoEmprestimo({ e, hoje, equipe, aoDevolver, aoPerder }: {
  e: Emprestimo; hoje: string; equipe: boolean; aoDevolver: () => void; aoPerder: () => void;
}) {
  const { atrasado, dias } = situacaoEmprestimo(e, hoje);
  const aberto = e.status === "em_aberto" || e.status === "devolvido_parcial";
  const u = e.item.unidade;

  return (
    <Card className={cn(atrasado && "border-red-300")}>
      <CardContent className="space-y-2 p-4 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{e.item.nome}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {e.item.codigo} · saiu de {e.origem.codigo}
            </p>
            {equipe ? (
              <p className="text-sm">
                {e.pessoa?.nome ?? "?"}
                {e.pessoa?.turma ? <span className="text-muted-foreground"> · {e.pessoa.turma}</span> : null}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold">
              {formatarQuantidade(aberto ? e.pendente : e.quantidade)} {u}
            </p>
            {atrasado && aberto ? (
              <Badge variant="danger">Atrasado {dias === 1 ? "1 dia" : `${dias} dias`}</Badge>
            ) : (
              <Badge variant={e.status === "perdido" ? "danger" : e.status === "devolvido" ? "success" : "default"}>
                {ROTULO_STATUS_EMPRESTIMO[e.status]}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Emprestado em {formatarDataHora(e.emprestado_em)}
          {e.prazo_previsto ? ` · devolver até ${formatarData(e.prazo_previsto)}` : " · sem prazo"}
          {e.quantidade_devolvida > 0 ? ` · devolvido ${formatarQuantidade(e.quantidade_devolvida)} ${u}` : ""}
          {e.quantidade_perdida > 0 ? ` · perdido ${formatarQuantidade(e.quantidade_perdida)} ${u}` : ""}
        </p>
        {e.observacao ? <p className="whitespace-pre-line text-xs text-muted-foreground">{e.observacao}</p> : null}
        {equipe && aberto ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={aoDevolver}>
              Devolver
            </Button>
            <Button size="sm" variant="ghost" onClick={aoPerder}>
              Marcar perdido
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Empréstimos em aberto (com atrasados destacados) e encerrados. Aluno vê só os próprios. */
export function PainelEmprestimos({ papel }: { papel: PapelUsuario }) {
  const equipe = papel === "admin" || papel === "professor";
  const [aba, setAba] = useState<Aba>("abertos");
  const [busca, setBusca] = useState("");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const emprestimosQ = useEmprestimos(aba);
  const hoje = hojeBrasilia();

  const lista = useMemo(() => {
    const filtrados = filtrarEmprestimos(emprestimosQ.data ?? [], busca, aba === "abertos" && soAtrasados, hoje);
    return aba === "abertos" ? ordenarAbertos(filtrados, hoje) : filtrados;
  }, [emprestimosQ.data, busca, soAtrasados, aba, hoje]);
  const atrasados = useMemo(
    () => (aba === "abertos" ? (emprestimosQ.data ?? []).filter((e) => situacaoEmprestimo(e, hoje).atrasado).length : 0),
    [emprestimosQ.data, aba, hoje],
  );

  return (
    <div className="space-y-4">
      {equipe ? <Button onClick={() => setJanela({ tipo: "novo" })}>Novo empréstimo</Button> : null}

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}

      <div className="flex gap-2" role="tablist">
        {(["abertos", "encerrados"] as const).map((a) => (
          <Button
            key={a}
            role="tab"
            aria-selected={aba === a}
            size="sm"
            variant={aba === a ? "default" : "outline"}
            onClick={() => setAba(a)}
          >
            {a === "abertos" ? "Em aberto" : "Devolvidos e perdidos"}
          </Button>
        ))}
      </div>

      {atrasados > 0 && !soAtrasados ? (
        <button
          type="button"
          onClick={() => setSoAtrasados(true)}
          className="w-full rounded-md bg-red-50 p-3 text-left text-sm text-red-900 hover:bg-red-100"
        >
          {atrasados === 1 ? "1 empréstimo está atrasado" : `${atrasados} empréstimos estão atrasados`}. Toque para ver.
        </button>
      ) : null}

      <div className="space-y-2">
        <Input
          type="search"
          aria-label="Buscar"
          placeholder={equipe ? "Buscar por pessoa, turma ou item" : "Buscar por item"}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {aba === "abertos" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soAtrasados} onChange={(e) => setSoAtrasados(e.target.checked)} />
            Só atrasados
          </label>
        ) : null}
      </div>

      {emprestimosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      {emprestimosQ.isError ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Não foi possível carregar os empréstimos: {emprestimosQ.error.message}
        </p>
      ) : null}
      {emprestimosQ.data && lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {aba === "abertos" ? "Nenhum empréstimo em aberto." : "Nenhum empréstimo encerrado."}
        </p>
      ) : null}

      <ul className="space-y-2">
        {lista.map((e) => (
          <li key={e.id}>
            <CartaoEmprestimo
              e={e}
              hoje={hoje}
              equipe={equipe}
              aoDevolver={() => setJanela({ tipo: "devolver", emprestimo: e })}
              aoPerder={() => setJanela({ tipo: "perder", emprestimo: e })}
            />
          </li>
        ))}
      </ul>

      {janela?.tipo === "novo" ? (
        <DialogoNovoEmprestimo
          aoFechar={() => setJanela(null)}
          aoConcluir={(m) => {
            setJanela(null);
            setAviso(m);
          }}
        />
      ) : null}
      {janela?.tipo === "devolver" ? (
        <DialogoDevolucao
          emprestimo={janela.emprestimo}
          aoFechar={() => setJanela(null)}
          aoConcluir={(m) => {
            setJanela(null);
            setAviso(m);
          }}
        />
      ) : null}
      {janela?.tipo === "perder" ? (
        <DialogoPerda
          emprestimo={janela.emprestimo}
          aoFechar={() => setJanela(null)}
          aoConcluir={(m) => {
            setJanela(null);
            setAviso(m);
          }}
        />
      ) : null}
    </div>
  );
}
