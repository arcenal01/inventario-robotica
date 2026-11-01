"use client";

import type { ReactNode } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarDataHora, hojeBrasilia } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { gerarCsv, nomeArquivo, type Coluna } from "./csv";

function baixar(conteudo: string, arquivo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Tabela de relatório: filtros (somem na impressão), botões CSV e PDF, cabeçalho de impressão e rodapé com totais.
 * PDF = imprimir e escolher "Salvar como PDF" (mesmo jeito do romaneio, sem biblioteca extra).
 */
export function TabelaRelatorio<T>({
  titulo,
  resumoFiltros,
  filtros,
  colunas,
  linhas,
  chave,
  carregando,
  erro,
  rodape,
  vazio = "Nada para mostrar com estes filtros.",
  limiteAtingido = false,
}: {
  titulo: string;
  resumoFiltros: string;
  filtros?: ReactNode;
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (l: T) => string;
  carregando: boolean;
  erro?: string | null;
  rodape?: ReactNode;
  vazio?: string;
  limiteAtingido?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <p className="text-xs">Inventário Robótica · emitido em {formatarDataHora(new Date().toISOString())}</p>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p className="text-sm">{resumoFiltros}</p>
      </div>

      {filtros ? <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">{filtros}</div> : null}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          variant="outline"
          disabled={carregando || linhas.length === 0}
          onClick={() => baixar(gerarCsv(colunas, linhas), nomeArquivo(titulo, hojeBrasilia()))}
        >
          <FileDown className="h-4 w-4" aria-hidden="true" /> Baixar CSV
        </Button>
        <Button variant="outline" disabled={carregando || linhas.length === 0} onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / PDF
        </Button>
        <span className="text-sm text-muted-foreground">
          {carregando ? "Carregando..." : `${linhas.length} linha(s)`} · {resumoFiltros}
        </span>
      </div>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Erro: {erro}
        </p>
      ) : null}
      {limiteAtingido ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 print:hidden">Muitas linhas: mostrando só as primeiras. Diminua o período.</p>
      ) : null}

      {!carregando && !erro && linhas.length === 0 ? <p className="text-sm text-muted-foreground">{vazio}</p> : null}

      {linhas.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full min-w-[640px] border-collapse text-sm print:min-w-0 print:text-[11px]">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground print:bg-transparent">
                {colunas.map((c) => (
                  <th key={c.titulo} scope="col" className={cn("whitespace-nowrap px-3 py-2.5 font-medium", c.numero && "text-right")}>
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={chave(l)} className="border-b last:border-0 hover:bg-accent/40 print:break-inside-avoid">
                  {colunas.map((c) => {
                    const v = c.valor(l);
                    return (
                      <td key={c.titulo} className={cn("px-3 py-2 align-top", c.numero && "text-right tabular-nums")}>
                        {typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : (v ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {rodape && linhas.length > 0 ? <div className="text-sm">{rodape}</div> : null}
    </div>
  );
}
