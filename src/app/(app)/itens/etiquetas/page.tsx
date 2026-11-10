import type { Metadata } from "next";
import Link from "next/link";
import { FolhaEtiquetas, type DadosEtiqueta } from "@/features/enderecos/folha-etiquetas";
import { selecionarItensParaEtiquetas, textoLocal } from "@/features/itens/etiquetas";
import { exigirAprovado } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Etiquetas de itens" };

const LIMITE = 300;

type Parametros = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

type LinhaSaldo = { item_id: string; quantidade_atual: number; endereco: { codigo: string } };

/**
 * Folha de etiquetas de itens. O QR guarda só o código do item (ex.: ALI-001).
 * Parâmetros da URL (um deles):
 *   ?codigos=ALI-001,FER-002   itens escolhidos (lista filtrada ou ficha do item)
 *   ?categoria=ID              itens ativos de uma categoria
 *   ?todos=1                   todos os itens ativos
 */
export default async function PaginaEtiquetasItens({ searchParams }: { searchParams: Promise<Parametros> }) {
  await exigirAprovado();
  const parametros = await searchParams;
  const supabase = await criarClienteServidor();

  const [{ data: itens }, { data: saldos }] = await Promise.all([
    supabase.from("vw_itens_estoque").select("id, codigo, nome, categoria_id, categoria_nome, status"),
    supabase
      .from("saldos_por_endereco")
      .select("item_id, quantidade_atual, endereco:enderecos!inner(codigo)")
      .gt("quantidade_atual", 0),
  ]);

  const lista = (itens ?? []).flatMap((i) =>
    i.id && i.codigo && i.nome && i.categoria_id && i.status
      ? [{ id: i.id, codigo: i.codigo, nome: i.nome, categoria_id: i.categoria_id, categoria_nome: i.categoria_nome ?? "", status: i.status }]
      : [],
  );

  const selecionados = selecionarItensParaEtiquetas(lista, {
    codigos: primeiro(parametros.codigos)?.split(",").filter(Boolean),
    categoriaId: primeiro(parametros.categoria),
    todos: primeiro(parametros.todos) === "1",
  });

  const saldosPorItem = new Map<string, { codigo: string; quantidade_atual: number }[]>();
  for (const s of (saldos ?? []) as LinhaSaldo[]) {
    saldosPorItem.set(s.item_id, [...(saldosPorItem.get(s.item_id) ?? []), { codigo: s.endereco.codigo, quantidade_atual: Number(s.quantidade_atual) }]);
  }

  const etiquetas: DadosEtiqueta[] = selecionados.slice(0, LIMITE).map((i) => {
    const local = textoLocal(saldosPorItem.get(i.id) ?? []);
    return { id: i.id, codigo: i.codigo, nome: i.nome, tipo: local ? `${i.categoria_nome} · ${local}` : i.categoria_nome };
  });

  return (
    <div className="space-y-4">
      <Link href="/itens" className="text-sm text-primary hover:underline print:hidden">
        Voltar para itens
      </Link>
      <FolhaEtiquetas etiquetas={etiquetas} titulo="Etiquetas de itens" doQue="do item" vazio="Nenhum item para imprimir." />
      {selecionados.length > LIMITE ? (
        <p className="text-sm text-muted-foreground print:hidden">
          Mostrando as primeiras {LIMITE} de {selecionados.length}. Imprima por partes (filtre por categoria).
        </p>
      ) : null}
    </div>
  );
}
