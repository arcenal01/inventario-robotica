"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ItemLista } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { SeletorItem } from "@/features/itens/seletor-item";
import { formatarDataHora, inicioDeDiasAtras } from "@/lib/datas";
import {
  LIMITE_HISTORICO,
  ROTULO_MOVIMENTACAO,
  useMovimentacoes,
  type Movimentacao,
  type TipoMovimentacao,
} from "./consultas";
import { DialogoMovimento, type TipoOperacao } from "./dialogo-movimento";

const PERIODOS = [
  { valor: "7", rotulo: "Últimos 7 dias" },
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "", rotulo: "Todo o período" },
];

/** Sinal da movimentação para o saldo da sala: + entra, - sai, ± muda de lugar. */
function sinal(m: Movimentacao): "+" | "-" | "±" {
  if (m.tipo === "entrada" || m.tipo === "devolucao") return "+";
  if (m.tipo === "saida" || m.tipo === "emprestimo") return "-";
  if (m.tipo === "ajuste") return m.destino ? "+" : "-";
  return "±";
}

function caminho(m: Movimentacao): string {
  if (m.origem && m.destino) return `${m.origem.codigo} → ${m.destino.codigo}`;
  return m.origem?.codigo ?? m.destino?.codigo ?? "";
}

/** Professor/admin: registram entradas, saídas, transferências e ajustes e consultam o histórico. */
export function PainelMovimentacoes() {
  const [operacao, setOperacao] = useState<TipoOperacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("30");
  const [tipo, setTipo] = useState<TipoMovimentacao | "">("");
  const [item, setItem] = useState<ItemLista | null>(null);

  const filtro = useMemo(
    () => ({ desde: periodo ? inicioDeDiasAtras(Number(periodo)) : null, tipo, itemId: item?.id ?? null }),
    [periodo, tipo, item],
  );
  const movimentosQ = useMovimentacoes(filtro);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button onClick={() => setOperacao("entrada")}>Entrada</Button>
        <Button variant="outline" onClick={() => setOperacao("saida")}>
          Saída
        </Button>
        <Button variant="outline" onClick={() => setOperacao("transferencia")}>
          Transferir
        </Button>
        <Button variant="outline" onClick={() => setOperacao("ajuste")}>
          Ajustar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Empréstimos e devoluções ficam em Empréstimos.</p>

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Select>
          <Select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacao | "")}>
            <option value="">Todos os tipos</option>
            {Object.entries(ROTULO_MOVIMENTACAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </div>
        <SeletorItem id="filtro-item" valor={item} aoMudar={setItem} mostrarSaldo={false} />

        {movimentosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
        {movimentosQ.isError ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Não foi possível carregar o histórico: {movimentosQ.error.message}
          </p>
        ) : null}
        {movimentosQ.data && movimentosQ.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação neste filtro.</p>
        ) : null}
        {movimentosQ.data && movimentosQ.data.length > 0 ? (
          <>
            <ul className="divide-y rounded-md border bg-card">
              {movimentosQ.data.map((m) => (
                <li key={m.id} className="space-y-1 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.item.nome}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {m.item.codigo} · {caminho(m)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold">
                        {sinal(m)}
                        {formatarQuantidade(m.quantidade)} {m.item.unidade}
                      </span>
                      <Badge variant={sinal(m) === "+" ? "success" : sinal(m) === "-" ? "warning" : "default"}>
                        {ROTULO_MOVIMENTACAO[m.tipo]}
                      </Badge>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatarDataHora(m.criado_em)} · {m.usuario?.nome ?? "?"}
                    {m.motivo ? ` · ${m.motivo}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            {movimentosQ.data.length === LIMITE_HISTORICO ? (
              <p className="text-xs text-muted-foreground">
                Mostrando as {LIMITE_HISTORICO} mais recentes. Use os filtros para ver as mais antigas.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {operacao ? (
        <DialogoMovimento
          tipo={operacao}
          aoFechar={() => setOperacao(null)}
          aoConcluir={(mensagem) => {
            setOperacao(null);
            setAviso(mensagem);
          }}
        />
      ) : null}
    </div>
  );
}
