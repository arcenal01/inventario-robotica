"use client";

import { Button } from "@/components/ui/button";
import { formatarQuantidade } from "@/features/itens/filtros";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { useRomaneio } from "./consultas";
import { ROTULO_STATUS_ROMANEIO, agruparPorEstrutura } from "./regras";

/** Versão para imprimir (ou "Salvar como PDF" na janela de impressão do navegador). */
export function FolhaRomaneio({ id }: { id: string }) {
  const romaneioQ = useRomaneio(id);
  if (romaneioQ.isPending) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (romaneioQ.isError) return <p className="text-sm text-red-800">Erro: {romaneioQ.error.message}</p>;
  const rom = romaneioQ.data;
  if (!rom) return <p className="text-sm text-muted-foreground">Romaneio não encontrado.</p>;
  const entregue = rom.status === "entregue";

  return (
    <div className="space-y-4">
      <div className="space-y-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          Para gerar PDF: toque em Imprimir e escolha <strong>Salvar como PDF</strong> como impressora.
        </p>
        <Button onClick={() => window.print()}>Imprimir</Button>
      </div>

      <article className="space-y-4 rounded-md border bg-card p-4 text-sm print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b pb-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Inventário Robótica · Romaneio</p>
            <h1 className="font-mono text-2xl font-bold">{rom.codigo}</h1>
            <p>
              {rom.pedido
                ? `Pedido ${rom.pedido.codigo} · ${rom.pedido.solicitante?.nome ?? ""}${rom.pedido.solicitante?.turma ? ` (${rom.pedido.solicitante.turma})` : ""}`
                : `Avulso: ${rom.descricao ?? ""}`}
            </p>
            {rom.pedido ? <p className="text-muted-foreground">Finalidade: {rom.pedido.finalidade}</p> : null}
          </div>
          <div className="text-right text-xs">
            <p>Gerado em {formatarDataHora(rom.criado_em)}</p>
            <p>Situação: {ROTULO_STATUS_ROMANEIO[rom.status]}</p>
            {rom.prazo_devolucao ? <p>Devolver emprestáveis até {formatarData(rom.prazo_devolucao)}</p> : null}
          </div>
        </header>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-xs">
              <th className="w-8 py-1">Sep.</th>
              <th className="py-1">Endereço</th>
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qtd.</th>
              <th className="w-20 py-1 text-right">Conferido</th>
            </tr>
          </thead>
          <tbody>
            {agruparPorEstrutura(rom.itens).flatMap((g) =>
              g.linhas.map((l) => (
                <tr key={l.id} className="border-b align-top">
                  <td className="py-1">
                    <span className="inline-block h-4 w-4 border border-black text-center text-xs leading-4">{l.separado ? "✓" : ""}</span>
                  </td>
                  <td className="py-1 font-mono">{l.endereco.codigo}</td>
                  <td className="py-1">
                    {l.item.nome}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {l.item.codigo}
                      {l.item.tipo_controle === "emprestavel" ? " · emprestável (devolver)" : ""}
                    </span>
                  </td>
                  <td className="py-1 text-right font-semibold">
                    {formatarQuantidade(l.quantidade)} {l.item.unidade}
                  </td>
                  <td className="py-1 text-right">
                    {entregue && l.quantidade_conferida !== null ? formatarQuantidade(l.quantidade_conferida) : "______"}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>

        <footer className="grid grid-cols-2 gap-8 pt-8 text-xs">
          <div>
            <div className="border-t border-black pt-1">
              Separado por{rom.separador ? `: ${rom.separador.nome}` : ""}
            </div>
          </div>
          <div>
            <div className="border-t border-black pt-1">
              Recebido por{rom.recebedor ? `: ${rom.recebedor.nome}` : ""}
              {rom.entregue_em ? ` em ${formatarDataHora(rom.entregue_em)}` : " · data: ____/____/______"}
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}
