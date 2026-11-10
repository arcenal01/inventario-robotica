"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { useSaldosDoItem, type ItemLista } from "./consultas";
import { formatarQuantidade } from "./filtros";
import { urlFoto } from "./foto";
import { ROTULO_TIPO_CONTROLE, jsonParaEspecificacoes } from "./schemas";

/** Ficha do item: foto, dados, especificações e em quais endereços ele está guardado. */
export function DetalheItem({
  item,
  podeEditar,
  aoEditar,
  aoEntrada,
  aoFechar,
}: {
  item: ItemLista;
  podeEditar: boolean;
  aoEditar: () => void;
  aoEntrada: () => void;
  aoFechar: () => void;
}) {
  const saldosQ = useSaldosDoItem(item.id);
  const queryClient = useQueryClient();
  const [repor, setRepor] = useState(item.repor);
  const [salvandoRepor, setSalvandoRepor] = useState(false);
  const [erroRepor, setErroRepor] = useState<string | null>(null);
  const foto = urlFoto(item.foto_url);

  /** "Não terá mais" (false) ou "Voltar a repor" (true). Só professor/admin (RLS de itens). */
  async function mudarRepor(valor: boolean) {
    setErroRepor(null);
    setSalvandoRepor(true);
    const { data, error } = await criarClienteNavegador().from("itens").update({ repor: valor }).eq("id", item.id).select("id");
    setSalvandoRepor(false);
    if (error || !data || data.length === 0) {
      setErroRepor(`Não foi possível salvar${error ? `: ${error.message}` : " (sem permissão)"}.`);
      return;
    }
    setRepor(valor);
    await queryClient.invalidateQueries({ queryKey: ["itens"] });
  }
  const especificacoes = jsonParaEspecificacoes(item.especificacoes);

  return (
    <Dialogo aberto titulo={item.nome} aoFechar={aoFechar}>
      <div className="space-y-4">
        <div className="flex gap-3">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do Storage; next/image exigiria configurar o domínio
            <img src={foto} alt={`Foto de ${item.nome}`} className="h-28 w-28 shrink-0 rounded-md border object-cover" />
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-sm font-semibold">{item.codigo}</p>
            <p className="text-sm text-muted-foreground">{item.categoria_nome}</p>
            <div className="flex flex-wrap gap-1">
              <Badge>{ROTULO_TIPO_CONTROLE[item.tipo_controle].split(" (")[0]}</Badge>
              {item.status === "inativo" ? <Badge variant="warning">Inativo</Badge> : null}
              {item.esgotado ? (
                repor ? <Badge variant="danger">Acabou: repor</Badge> : <Badge variant="warning">Não terá mais</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded-md bg-secondary p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Em estoque</dt>
            <dd className="text-lg font-semibold">
              {formatarQuantidade(item.saldo_total)} {item.unidade}
            </dd>
          </div>
          {item.tipo_controle === "emprestavel" ? (
            <div>
              <dt className="text-muted-foreground">Emprestado (fora da sala)</dt>
              <dd className="font-semibold">
                {formatarQuantidade(item.emprestado_em_aberto)} {item.unidade}
              </dd>
            </div>
          ) : null}
        </dl>

        {item.esgotado ? (
          <div
            role="status"
            className={`space-y-2 rounded-md p-3 text-sm ${repor ? "bg-red-50 text-red-900" : "bg-secondary text-muted-foreground"}`}
          >
            <p className="font-semibold">
              {repor ? "Acabou o estoque: avise para repor." : "Acabou e não terá mais no estoque."}
            </p>
            {podeEditar ? (
              <div className="flex flex-wrap gap-2">
                {repor ? (
                  <>
                    <Button size="sm" onClick={aoEntrada}>
                      Registrar reposição
                    </Button>
                    <Button size="sm" variant="outline" disabled={salvandoRepor} onClick={() => void mudarRepor(false)}>
                      Não terá mais
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={salvandoRepor} onClick={() => void mudarRepor(true)}>
                    Voltar a repor
                  </Button>
                )}
              </div>
            ) : null}
            {erroRepor ? <p className="text-red-800">{erroRepor}</p> : null}
          </div>
        ) : !repor ? (
          <p className="text-xs text-muted-foreground">Marcado como “não terá mais”: quando acabar, não aparece aviso para repor.</p>
        ) : null}

        {item.descricao ? <p className="whitespace-pre-line text-sm">{item.descricao}</p> : null}

        {especificacoes.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Especificações</h3>
            <dl className="divide-y rounded-md border text-sm">
              {especificacoes.map((e) => (
                <div key={e.chave} className="flex justify-between gap-2 px-3 py-2">
                  <dt className="text-muted-foreground">{e.chave}</dt>
                  <dd className="text-right">{e.valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Onde está guardado</h3>
          {saldosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {saldosQ.isError && !saldosQ.data ? (
            <p role="alert" className="text-sm text-red-800">
              Não foi possível carregar os endereços: {saldosQ.error.message}
            </p>
          ) : null}
          {saldosQ.data && saldosQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum endereço com saldo.</p>
          ) : null}
          {saldosQ.data && saldosQ.data.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {saldosQ.data.map((s) => (
                <li key={s.endereco_id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{s.codigo}</span>
                    {s.nome ? <span className="text-muted-foreground"> · {s.nome}</span> : null}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatarQuantidade(s.quantidade_atual)} {item.unidade}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/itens/etiquetas?codigos=${encodeURIComponent(item.codigo)}`}
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary"
          >
            Etiqueta QR
          </Link>
          {podeEditar ? (
            <>
              <Button variant="outline" onClick={aoEntrada} disabled={item.status !== "ativo"}>
                Registrar entrada
              </Button>
              <Button variant="outline" onClick={aoEditar}>
                Editar
              </Button>
            </>
          ) : null}
          <Button onClick={aoFechar}>Fechar</Button>
        </div>
      </div>
    </Dialogo>
  );
}
