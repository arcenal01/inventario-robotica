"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarQuantidade } from "@/features/itens/filtros";
import { formatarDataHora } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useContagem, useLinhasDaContagem, usePosicoesDaContagem, type LinhaContagem } from "./consultas";
import { descreverEscopo } from "./lista-contagens";
import {
  ABERTAS,
  COR_SITUACAO_POSICAO,
  COR_STATUS_CONTAGEM,
  ROTULO_SITUACAO_POSICAO,
  ROTULO_STATUS_CONTAGEM,
  agruparPosicoes,
  ajustesPrevistos,
  linhasAtuais,
  planoEncerramento,
  recebeContagens,
  resumoPosicoes,
  situacaoPosicao,
} from "./regras";

const LINK_BOTAO =
  "inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90";

function comSinal(n: number) {
  return n > 0 ? `+${formatarQuantidade(n)}` : n < 0 ? `−${formatarQuantidade(-n)}` : "0";
}

function ordenarLinhas<T extends { endereco: { codigo: string }; item: { nome: string } }>(linhas: T[]): T[] {
  return [...linhas].sort(
    (a, b) =>
      a.endereco.codigo.localeCompare(b.endereco.codigo, "pt-BR", { numeric: true }) || a.item.nome.localeCompare(b.item.nome, "pt-BR"),
  );
}

/** Revisão do professor: última rodada de cada item/posição, com sistema x contado e o botão de recontagem. */
function LinhaRevisao({
  linha,
  podeRecontar,
  ocupado,
  aoRecontar,
}: {
  linha: LinhaContagem;
  podeRecontar: boolean;
  ocupado: boolean;
  aoRecontar: () => void;
}) {
  const un = linha.item.unidade;
  return (
    <Card className={cn(linha.divergencia !== 0 && !linha.ajuste_movimentacao_id && "border-amber-300")}>
      <CardContent className="space-y-1 p-3 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block font-mono text-sm font-semibold">{linha.endereco.codigo}</span>
            <span className="block truncate text-sm">{linha.item.nome}</span>
          </span>
          <span
            className={cn(
              "shrink-0 text-lg font-semibold",
              linha.divergencia > 0 && "text-emerald-700",
              linha.divergencia < 0 && "text-red-700",
            )}
          >
            {comSinal(linha.divergencia)} {un}
          </span>
        </div>
        <p className="text-sm">
          Sistema {formatarQuantidade(linha.quantidade_sistema)} · Contado {formatarQuantidade(linha.quantidade_contada)}
          {linha.emprestado_em_aberto > 0 ? (
            <span className="text-muted-foreground"> · {formatarQuantidade(linha.emprestado_em_aberto)} emprestado (não é divergência)</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{linha.nao_listado ? "Ninguém contou (não listado)" : `Contado por ${linha.contador?.nome ?? "?"}`}</span>
          {linha.rodada > 1 ? <Badge>{linha.rodada}ª contagem</Badge> : null}
          {linha.recontagem_pendente ? <Badge variant="danger">Aguardando recontagem</Badge> : null}
          {linha.ajuste_movimentacao_id ? <Badge variant="success">Ajuste gerado</Badge> : null}
        </div>
        {podeRecontar && linha.divergencia !== 0 && !linha.recontagem_pendente && !linha.ajuste_movimentacao_id ? (
          <Button size="sm" variant="outline" disabled={ocupado} onClick={aoRecontar}>
            Pedir recontagem
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Página da contagem: progresso por posição, botão de contar e (professor/admin) revisão, encerramento e aprovação. */
export function DetalheContagem({ id, equipe }: { id: string; equipe: boolean }) {
  const queryClient = useQueryClient();
  const contagemQ = useContagem(id);
  const posicoesQ = usePosicoesDaContagem(id);
  const linhasQ = useLinhasDaContagem(id);
  const [mostrarVazias, setMostrarVazias] = useState(false);
  const [soDivergencias, setSoDivergencias] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const posicoes = useMemo(() => posicoesQ.data ?? [], [posicoesQ.data]);
  const atuais = useMemo(() => ordenarLinhas(linhasAtuais(linhasQ.data ?? [])), [linhasQ.data]);
  const grupos = useMemo(
    () => agruparPosicoes(mostrarVazias ? posicoes : posicoes.filter((p) => situacaoPosicao(p) !== "vazia")),
    [posicoes, mostrarVazias],
  );

  if (contagemQ.isPending) return <p className="text-sm text-muted-foreground">Carregando contagem...</p>;
  if (contagemQ.isError && !contagemQ.data) return <p className="text-sm text-red-800">Erro: {contagemQ.error.message}</p>;
  const cnt = contagemQ.data;
  if (!cnt) return <p className="text-sm text-muted-foreground">Contagem não encontrada.</p>;

  const recebendo = recebeContagens(cnt.status);
  const resumo = resumoPosicoes(posicoes);
  const ajustes = ajustesPrevistos(linhasQ.data ?? []);
  const visiveis = soDivergencias ? atuais.filter((l) => l.divergencia !== 0) : atuais;
  const supabase = criarClienteNavegador();

  async function chamar(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, mensagem: (dados: never) => string) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    const { data, error } = await fn();
    setOcupado(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await Promise.all(["contagens", "itens", "saldos", "movimentacoes"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    setAviso(mensagem(data as never));
  }

  const encerrar = () => {
    const plano = planoEncerramento(posicoes);
    const avisos = [
      plano.semContagemComMaterial > 0
        ? `${plano.semContagemComMaterial} posição(ões) com material não foram contadas e ficam como estão no sistema.`
        : "",
      plano.parciais > 0
        ? `Em ${plano.parciais} posição(ões) há itens que ninguém contou: eles entram como "não listado" (contado = 0) para você revisar.`
        : "",
    ].filter(Boolean);
    if (!window.confirm([...avisos, "Encerrar a contagem e ir para a revisão?"].join("\n\n"))) return;
    void chamar(
      () => supabase.rpc("encerrar_contagem", { p_contagem_id: cnt.id, p_forcar: plano.forcar }),
      (d: { divergencias: number }) => `Contagem encerrada: ${d.divergencias} divergência(s) para revisar.`,
    );
  };

  const aprovar = () => {
    const texto =
      ajustes.length === 0
        ? "Nenhuma divergência: o estoque não muda. Aprovar a contagem?"
        : `Serão gerados ${ajustes.length} ajuste(s) de estoque (a diferença é somada ao saldo atual de cada posição). Aprovar a contagem?`;
    if (!window.confirm(texto)) return;
    void chamar(
      () => supabase.rpc("aprovar_contagem", { p_contagem_id: cnt.id }),
      (d: { ajustes_gerados: number }) => `Contagem aprovada: ${d.ajustes_gerados} ajuste(s) gerado(s).`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{cnt.codigo}</h1>
          <p className="text-sm text-muted-foreground">{descreverEscopo(cnt)}</p>
          <p className="text-xs text-muted-foreground">
            Aberta em {formatarDataHora(cnt.criado_em)}
            {cnt.abertaPor ? ` por ${cnt.abertaPor.nome}` : ""}
            {cnt.aprovada_em ? ` · aprovada em ${formatarDataHora(cnt.aprovada_em)}` : ""}
            {cnt.aprovadaPor ? ` por ${cnt.aprovadaPor.nome}` : ""}
          </p>
          {cnt.observacao ? <p className="text-sm">{cnt.observacao}</p> : null}
        </div>
        <Badge variant={COR_STATUS_CONTAGEM[cnt.status]}>{ROTULO_STATUS_CONTAGEM[cnt.status]}</Badge>
      </div>

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      {recebendo ? (
        <Link href={`/contagens/${cnt.id}/contar`} className={cn(LINK_BOTAO, "w-full sm:w-auto")}>
          Contar uma posição (QR ou código)
        </Link>
      ) : null}
      {cnt.status === "em_revisao" && !equipe ? (
        <p className="text-sm text-muted-foreground">A contagem está em revisão pelo professor.</p>
      ) : null}

      {ABERTAS.includes(cnt.status) ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Posições</h2>
          {posicoesQ.isPending ? <p className="text-sm text-muted-foreground">Carregando posições...</p> : null}
          {posicoesQ.isError && !posicoesQ.data ? <p className="text-sm text-red-800">Erro: {posicoesQ.error.message}</p> : null}
          {posicoesQ.data ? (
            <p className="text-sm">
              <span className="font-semibold">{resumo.contadas}</span> contada(s) · {resumo.faltam} faltando
              {resumo.recontar > 0 ? ` · ${resumo.recontar} para recontar` : ""} · {resumo.vazias} vazia(s) no sistema
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={mostrarVazias} onChange={(e) => setMostrarVazias(e.target.checked)} />
            Mostrar posições vazias no sistema
          </label>
          {grupos.map((g) => (
            <div key={g.estrutura} className="space-y-1">
              <h3 className="font-mono text-sm font-semibold text-muted-foreground">{g.estrutura}</h3>
              <ul className="space-y-1">
                {g.posicoes.map((p) => {
                  const s = situacaoPosicao(p);
                  const conteudo = (
                    <Card className={cn(recebendo && "transition-colors hover:bg-accent")}>
                      <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-3">
                        <span className="min-w-0">
                          <span className="block font-mono text-sm font-semibold">{p.codigo}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.nome ? `${p.nome} · ` : ""}
                            {p.itens_contados} contado(s)
                            {p.itens_faltando > 0 ? ` · faltam ${p.itens_faltando}` : ""}
                            {p.contada_por_mim ? " · você contou aqui" : ""}
                          </span>
                        </span>
                        <Badge variant={COR_SITUACAO_POSICAO[s]}>{ROTULO_SITUACAO_POSICAO[s]}</Badge>
                      </CardContent>
                    </Card>
                  );
                  return (
                    <li key={p.endereco_id}>
                      {recebendo ? (
                        <Link href={`/contagens/${cnt.id}/contar?endereco=${p.endereco_id}`} className="block">
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {posicoesQ.data && grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma posição com material nesta contagem.</p>
          ) : null}
        </section>
      ) : null}

      {!equipe ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">O que você contou</h2>
          {linhasQ.data && linhasQ.data.length === 0 ? <p className="text-sm text-muted-foreground">Nada ainda.</p> : null}
          <ul className="space-y-1">
            {ordenarLinhas(linhasQ.data ?? []).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-muted-foreground">{l.endereco.codigo}</span>
                  <span className="block truncate">{l.item.nome}</span>
                </span>
                <span className="shrink-0 font-semibold">
                  {formatarQuantidade(l.quantidade_contada)} {l.item.unidade}
                  {l.rodada > 1 ? <span className="block text-xs font-normal text-muted-foreground">recontagem</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {equipe ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{cnt.status === "em_revisao" ? "Revisão" : "Resultado"}</h2>
          {linhasQ.isPending ? <p className="text-sm text-muted-foreground">Carregando linhas...</p> : null}
          {linhasQ.isError && !linhasQ.data ? <p className="text-sm text-red-800">Erro: {linhasQ.error.message}</p> : null}
          {linhasQ.data ? (
            <p className="text-sm">
              {atuais.length} linha(s) contada(s) · {atuais.filter((l) => l.divergencia !== 0).length} com divergência
              {cnt.status === "em_revisao" ? ` · ${ajustes.length} ajuste(s) se aprovar` : ""}
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={soDivergencias} onChange={(e) => setSoDivergencias(e.target.checked)} />
            Só divergências
          </label>
          <ul className="space-y-2">
            {visiveis.map((l) => (
              <li key={l.id}>
                <LinhaRevisao
                  linha={l}
                  podeRecontar={cnt.status === "em_revisao"}
                  ocupado={ocupado}
                  aoRecontar={() =>
                    void chamar(
                      () => supabase.rpc("solicitar_recontagem", { p_contagem_id: cnt.id, p_endereco_id: l.endereco_id, p_item_id: l.item_id }),
                      () => `Recontagem pedida: outra pessoa deve contar ${l.item.nome} em ${l.endereco.codigo}. A contagem voltou para "Em andamento".`,
                    )
                  }
                />
              </li>
            ))}
          </ul>
          {linhasQ.data && visiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">{soDivergencias ? "Nenhuma divergência." : "Nada contado ainda."}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {cnt.status === "em_andamento" ? (
              <Button disabled={ocupado || !posicoesQ.data} onClick={encerrar}>
                Encerrar e revisar
              </Button>
            ) : null}
            {cnt.status === "em_revisao" ? (
              <Button disabled={ocupado || !linhasQ.data} onClick={aprovar}>
                Aprovar e ajustar estoque
              </Button>
            ) : null}
            {ABERTAS.includes(cnt.status) ? (
              <Button
                variant="ghost"
                disabled={ocupado}
                onClick={() => {
                  if (window.confirm(`Cancelar a contagem ${cnt.codigo}? Nenhum ajuste será feito.`)) {
                    void chamar(() => supabase.rpc("cancelar_contagem", { p_contagem_id: cnt.id }), () => "Contagem cancelada.");
                  }
                }}
              >
                Cancelar contagem
              </Button>
            ) : null}
          </div>
          {cnt.status === "aberta" ? <p className="text-xs text-muted-foreground">Ninguém contou ainda: o encerramento libera depois da primeira posição contada.</p> : null}
          {cnt.status === "aprovada" ? (
            <p className="text-xs text-muted-foreground">
              Os ajustes aparecem em{" "}
              <Link href="/movimentacoes" className="text-primary hover:underline">
                Movimentações
              </Link>{" "}
              com o motivo &quot;Contagem {cnt.codigo}&quot;.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
