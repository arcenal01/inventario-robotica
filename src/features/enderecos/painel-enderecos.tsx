"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { PapelUsuario } from "@/types";
import { compararCodigos, montarArvore, type Endereco, type NoArvore, type TipoEndereco } from "./arvore";
import { useEnderecos, useTiposEndereco, useTrocasPendentes } from "./consultas";
import { DialogoEndereco } from "./dialogo-endereco";
import { DialogoMover } from "./dialogo-mover";

type Acao =
  | { tipo: "novo"; pai: Endereco | null }
  | { tipo: "editar"; endereco: Endereco }
  | { tipo: "mover"; endereco: Endereco }
  | null;

type Contexto = {
  tiposPorId: Map<string, TipoEndereco>;
  enderecosPorId: Map<string, Endereco>;
  tipos: TipoEndereco[];
  podeEditar: boolean;
  abertos: Set<string>;
  alternarAberto: (id: string) => void;
  selecionadoId: string | null;
  selecionar: (id: string | null) => void;
  ocupadoId: string | null;
  abrirNovo: (pai: Endereco) => void;
  abrirEditar: (e: Endereco) => void;
  abrirMover: (e: Endereco) => void;
  alternarAtivo: (e: Endereco) => void;
};

function BarraAcoes({ no, ctx }: { no: NoArvore; ctx: Contexto }) {
  const tipo = ctx.tiposPorId.get(no.tipo_endereco_id);
  const podeCriarDentro =
    ctx.podeEditar && no.ativo && tipo !== undefined && !tipo.armazena_itens && ctx.tipos.some((t) => t.ativo && t.nivel > tipo.nivel);
  const podeMover = ctx.podeEditar && no.ativo && no.pai_id !== null;
  const ocupado = ctx.ocupadoId === no.id;

  return (
    <div className="flex flex-wrap gap-2 pb-2 pl-8 pt-1">
      {no.ativo ? (
        <Link href={`/enderecos/etiquetas?ids=${no.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Etiqueta QR
        </Link>
      ) : null}
      {no.ativo && no.filhos.length > 0 ? (
        <Link href={`/enderecos/etiquetas?raiz=${no.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Etiquetas de tudo dentro
        </Link>
      ) : null}
      {podeCriarDentro ? (
        <Button size="sm" variant="outline" onClick={() => ctx.abrirNovo(no)}>
          Novo dentro
        </Button>
      ) : null}
      {ctx.podeEditar && no.ativo ? (
        <Button size="sm" variant="outline" onClick={() => ctx.abrirEditar(no)}>
          Editar
        </Button>
      ) : null}
      {podeMover ? (
        <Button size="sm" variant="outline" onClick={() => ctx.abrirMover(no)}>
          Mover
        </Button>
      ) : null}
      {ctx.podeEditar && no.substituido_por_id === null ? (
        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => ctx.alternarAtivo(no)}>
          {no.ativo ? "Desativar" : "Reativar"}
        </Button>
      ) : null}
    </div>
  );
}

function Linha({ no, nivel, ctx, plano }: { no: NoArvore; nivel: number; ctx: Contexto; plano: boolean }) {
  const tipo = ctx.tiposPorId.get(no.tipo_endereco_id);
  const temFilhos = !plano && no.filhos.length > 0;
  const aberto = ctx.abertos.has(no.id);
  const selecionado = ctx.selecionadoId === no.id;
  const substituto = no.substituido_por_id ? ctx.enderecosPorId.get(no.substituido_por_id) : undefined;

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: plano ? 0 : nivel * 14 }}>
        {temFilhos ? (
          <button
            type="button"
            aria-label={aberto ? "Recolher" : "Expandir"}
            aria-expanded={aberto}
            onClick={() => ctx.alternarAberto(no.id)}
            className="flex h-9 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          >
            {aberto ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-7 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => ctx.selecionar(selecionado ? null : no.id)}
          aria-expanded={selecionado}
          className="flex min-h-11 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1 text-left hover:bg-accent"
        >
          <span className={no.ativo ? "font-mono text-sm font-semibold" : "font-mono text-sm text-muted-foreground line-through"}>
            {no.codigo}
          </span>
          {no.nome ? <span className="text-sm">{no.nome}</span> : null}
          {tipo ? <Badge>{tipo.nome}</Badge> : null}
          {!no.ativo ? (
            <Badge variant="warning">{substituto ? `Substituído por ${substituto.codigo}` : "Inativo"}</Badge>
          ) : null}
          {temFilhos ? <span className="text-xs text-muted-foreground">{no.filhos.length} dentro</span> : null}
        </button>
      </div>
      {selecionado ? (
        <div style={{ paddingLeft: plano ? 0 : nivel * 14 }}>
          {no.descricao ? <p className="pb-1 pl-8 text-sm text-muted-foreground">{no.descricao}</p> : null}
          <BarraAcoes no={no} ctx={ctx} />
        </div>
      ) : null}
      {temFilhos && aberto ? (
        <ul>
          {no.filhos.map((f) => (
            <Linha key={f.id} no={f} nivel={nivel + 1} ctx={ctx} plano={false} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PainelEnderecos({ papel }: { papel: PapelUsuario }) {
  const podeEditar = papel !== "aluno";
  const eAdmin = papel === "admin";
  const queryClient = useQueryClient();
  const enderecosQ = useEnderecos();
  const tiposQ = useTiposEndereco();
  const pendentesQ = useTrocasPendentes(podeEditar);

  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const enderecos = useMemo(() => enderecosQ.data ?? [], [enderecosQ.data]);
  const tipos = useMemo(() => tiposQ.data ?? [], [tiposQ.data]);
  const tiposPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);
  const enderecosPorId = useMemo(() => new Map(enderecos.map((e) => [e.id, e])), [enderecos]);

  const visiveis = useMemo(() => enderecos.filter((e) => mostrarInativos || e.ativo), [enderecos, mostrarInativos]);
  const arvore = useMemo(() => montarArvore(visiveis), [visiveis]);

  const termo = busca.trim().toLowerCase();
  const resultadosBusca = useMemo(() => {
    if (termo === "") return [];
    return visiveis
      .filter((e) => e.codigo.toLowerCase().includes(termo) || (e.nome ?? "").toLowerCase().includes(termo))
      .sort(compararCodigos)
      .map((e): NoArvore => ({ ...e, filhos: [] }));
  }, [termo, visiveis]);

  const alternarAtivo = useMutation({
    mutationFn: async (e: Endereco) => {
      const { data, error } = await criarClienteNavegador()
        .from("enderecos")
        .update({ ativo: !e.ativo })
        .eq("id", e.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Sem permissão ou endereço não encontrado.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enderecos"] }),
  });

  const ctx: Contexto = {
    tiposPorId,
    enderecosPorId,
    tipos,
    podeEditar,
    abertos,
    alternarAberto: (id) =>
      setAbertos((antes) => {
        const depois = new Set(antes);
        if (depois.has(id)) depois.delete(id);
        else depois.add(id);
        return depois;
      }),
    selecionadoId,
    selecionar: setSelecionadoId,
    ocupadoId: alternarAtivo.isPending ? (alternarAtivo.variables?.id ?? null) : null,
    abrirNovo: (pai) => setAcao({ tipo: "novo", pai }),
    abrirEditar: (endereco) => setAcao({ tipo: "editar", endereco }),
    abrirMover: (endereco) => setAcao({ tipo: "mover", endereco }),
    alternarAtivo: (e) => {
      if (e.ativo && !window.confirm(`Desativar ${e.codigo}?`)) return;
      setErroAcao(null);
      alternarAtivo.mutate(e);
    },
  };

  const fechar = () => setAcao(null);
  const concluir = (mensagem: string) => {
    setAcao(null);
    setErroAcao(null);
    setAviso(mensagem);
  };

  if (enderecosQ.isPending || tiposQ.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando endereços...</p>;
  }

  if (enderecosQ.isError || tiposQ.isError) {
    const mensagem = enderecosQ.error?.message ?? tiposQ.error?.message ?? "erro desconhecido";
    return (
      <div role="alert" className="space-y-3 rounded-md bg-red-50 p-4 text-sm text-red-800">
        <p>Não foi possível carregar os endereços: {mensagem}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void enderecosQ.refetch();
            void tiposQ.refetch();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const totalPendentes = pendentesQ.data ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {podeEditar ? (
          <Button size="sm" onClick={() => setAcao({ tipo: "novo", pai: null })}>
            Novo endereço
          </Button>
        ) : null}
        <Link href="/enderecos/etiquetas?todos=1" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Todas as etiquetas
        </Link>
        {podeEditar ? (
          <Link href="/enderecos/trocas" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Trocas de QR{totalPendentes > 0 ? ` (${totalPendentes})` : ""}
          </Link>
        ) : null}
        {eAdmin ? (
          <Link href="/enderecos/tipos" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Tipos de endereço
          </Link>
        ) : null}
      </div>

      {podeEditar && totalPendentes > 0 ? (
        <Link href="/enderecos/trocas" className="block rounded-md bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
          Há {totalPendentes} troca(s) de etiqueta de QR pendente(s). Toque para ver.
        </Link>
      ) : null}

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}
      {erroAcao || alternarAtivo.isError ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erroAcao ?? alternarAtivo.error?.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Input
          type="search"
          placeholder="Buscar por código ou nome (ex.: ARM01, caixa)"
          aria-label="Buscar endereço"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos e substituídos
        </label>
      </div>

      {enderecos.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum endereço cadastrado ainda.
          {podeEditar ? " Toque em Novo endereço para criar o primeiro armário ou estante." : ""}
        </p>
      ) : termo !== "" ? (
        resultadosBusca.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum endereço encontrado.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card p-1">
            {resultadosBusca.map((no) => (
              <Linha key={no.id} no={no} nivel={0} ctx={ctx} plano />
            ))}
          </ul>
        )
      ) : (
        <ul className="divide-y rounded-lg border bg-card p-1">
          {arvore.map((no) => (
            <Linha key={no.id} no={no} nivel={0} ctx={ctx} plano={false} />
          ))}
        </ul>
      )}

      <DialogoEndereco
        configuracao={
          acao?.tipo === "novo"
            ? { modo: "novo", pai: acao.pai, tipos, aoFechar: fechar, aoConcluir: concluir }
            : acao?.tipo === "editar"
              ? { modo: "editar", endereco: acao.endereco, aoFechar: fechar, aoConcluir: concluir }
              : null
        }
      />
      <DialogoMover
        endereco={acao?.tipo === "mover" ? acao.endereco : null}
        enderecos={enderecos}
        tipos={tipos}
        aoFechar={fechar}
        aoConcluir={concluir}
      />
    </div>
  );
}
