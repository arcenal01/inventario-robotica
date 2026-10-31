"use client";

import { Select } from "@/components/ui/select";
import { useSaldosDoItem } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { usePosicoes } from "./consultas";

/** Escolhe uma posição onde o item TEM saldo (saída, transferência, empréstimo). */
export function SeletorOrigem({
  id,
  itemId,
  unidade,
  valor,
  aoMudar,
}: {
  id: string;
  itemId: string;
  unidade: string;
  valor: string;
  aoMudar: (enderecoId: string, saldo: number) => void;
}) {
  const saldosQ = useSaldosDoItem(itemId);
  if (saldosQ.isPending) return <p className="text-sm text-muted-foreground">Carregando endereços...</p>;
  if (saldosQ.isError) return <p className="text-sm text-red-800">Erro: {saldosQ.error.message}</p>;
  const saldos = saldosQ.data ?? [];
  if (saldos.length === 0) return <p className="text-sm text-amber-900">Este item não tem saldo em nenhum endereço.</p>;

  return (
    <Select
      id={id}
      value={valor}
      onChange={(e) => {
        const s = saldos.find((x) => x.endereco_id === e.target.value);
        aoMudar(e.target.value, s?.quantidade_atual ?? 0);
      }}
    >
      <option value="">Escolha o endereço</option>
      {saldos.map((s) => (
        <option key={s.endereco_id} value={s.endereco_id}>
          {s.codigo} ({formatarQuantidade(s.quantidade_atual)} {unidade})
        </option>
      ))}
    </Select>
  );
}

/** Escolhe qualquer posição ativa; mostra quanto do item já tem em cada uma. */
export function SeletorPosicao({
  id,
  itemId,
  unidade,
  valor,
  aoMudar,
  excluir,
}: {
  id: string;
  itemId: string | null;
  unidade?: string;
  valor: string;
  aoMudar: (enderecoId: string) => void;
  excluir?: string;
}) {
  const posicoesQ = usePosicoes();
  const saldosQ = useSaldosDoItem(itemId);
  if (posicoesQ.isPending) return <p className="text-sm text-muted-foreground">Carregando posições...</p>;
  if (posicoesQ.isError) return <p className="text-sm text-red-800">Erro: {posicoesQ.error.message}</p>;
  const saldo = new Map((saldosQ.data ?? []).map((s) => [s.endereco_id, s.quantidade_atual]));
  const posicoes = (posicoesQ.data ?? []).filter((p) => p.id !== excluir);
  if (posicoes.length === 0) {
    return <p className="text-sm text-amber-900">Não há posições ativas. Crie posições em Endereços.</p>;
  }

  return (
    <Select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">Escolha a posição</option>
      {posicoes.map((p) => (
        <option key={p.id} value={p.id}>
          {p.codigo}
          {p.nome ? ` · ${p.nome}` : ""}
          {saldo.has(p.id) ? ` (já tem ${formatarQuantidade(saldo.get(p.id)!)} ${unidade ?? ""})` : ""}
        </option>
      ))}
    </Select>
  );
}
