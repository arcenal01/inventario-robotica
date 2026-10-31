"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItens, type ItemLista } from "./consultas";
import { FILTROS_INICIAIS, filtrarItens, formatarQuantidade } from "./filtros";

const MAXIMO_RESULTADOS = 8;

/**
 * Campo para escolher um item digitando código ou nome (lista curta de resultados, bom no celular).
 * `aceitar` restringe os itens que podem ser escolhidos (ex.: só emprestáveis).
 */
export function SeletorItem({
  id,
  valor,
  aoMudar,
  aceitar,
  mostrarSaldo = true,
}: {
  id: string;
  valor: ItemLista | null;
  aoMudar: (item: ItemLista | null) => void;
  aceitar?: (item: ItemLista) => boolean;
  mostrarSaldo?: boolean;
}) {
  const itensQ = useItens();
  const [busca, setBusca] = useState("");

  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const ativos = filtrarItens(itensQ.data ?? [], { ...FILTROS_INICIAIS, busca });
    return (aceitar ? ativos.filter(aceitar) : ativos).slice(0, MAXIMO_RESULTADOS);
  }, [itensQ.data, busca, aceitar]);

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-secondary px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate font-medium">{valor.nome}</span>
          <span className="block font-mono text-xs text-muted-foreground">
            {valor.codigo}
            {mostrarSaldo ? ` · ${formatarQuantidade(valor.saldo_total)} ${valor.unidade} em estoque` : ""}
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => aoMudar(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="search"
        autoComplete="off"
        placeholder={itensQ.isPending ? "Carregando itens..." : "Digite o código ou o nome"}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {busca.trim() && resultados.length === 0 && !itensQ.isPending ? (
        <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
      ) : null}
      {resultados.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {resultados.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-secondary"
                onClick={() => {
                  aoMudar(item);
                  setBusca("");
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{item.codigo}</span>
                </span>
                {mostrarSaldo ? (
                  <span className="shrink-0 text-sm">
                    {formatarQuantidade(item.saldo_total)} {item.unidade}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
