import type { Metadata } from "next";
import Link from "next/link";
import { FolhaEtiquetas, type DadosEtiqueta } from "@/features/enderecos/folha-etiquetas";
import { selecionarParaEtiquetas } from "@/features/enderecos/arvore";
import { exigirAprovado } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Etiquetas de QR" };

const LIMITE = 300;

type Parametros = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Folha de etiquetas. Parâmetros da URL (um deles):
 *   ?ids=a,b      endereços escolhidos
 *   ?raiz=ID      o endereço e tudo que está dentro dele
 *   ?todos=1      todos os endereços ativos
 *   ?troca=ID     os endereços novos de uma troca de QR
 */
export default async function PaginaEtiquetas({ searchParams }: { searchParams: Promise<Parametros> }) {
  await exigirAprovado();
  const parametros = await searchParams;
  const supabase = await criarClienteServidor();

  const [{ data: enderecos }, { data: tipos }] = await Promise.all([
    supabase.from("enderecos").select("*"),
    supabase.from("tipos_endereco").select("*"),
  ]);

  let titulo = "Etiquetas de QR";
  let novosIds: string[] | undefined;
  const troca = primeiro(parametros.troca);
  if (troca) {
    const { data } = await supabase.from("vw_troca_qr_etiquetas").select("endereco_novo_id").eq("troca_id", troca);
    novosIds = (data ?? []).map((l) => l.endereco_novo_id).filter((id): id is string => id !== null);
    titulo = "Etiquetas novas da troca de QR";
  }

  const selecionados = selecionarParaEtiquetas(enderecos ?? [], {
    ids: primeiro(parametros.ids)?.split(",").filter(Boolean),
    raiz: primeiro(parametros.raiz),
    todos: primeiro(parametros.todos) === "1",
    novosIds,
  });

  const tiposPorId = new Map((tipos ?? []).map((t) => [t.id, t.nome]));
  const etiquetas: DadosEtiqueta[] = selecionados.slice(0, LIMITE).map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nome: e.nome,
    tipo: tiposPorId.get(e.tipo_endereco_id) ?? "",
  }));

  return (
    <div className="space-y-4">
      <Link href="/enderecos" className="text-sm text-primary hover:underline print:hidden">
        Voltar para endereços
      </Link>
      <FolhaEtiquetas etiquetas={etiquetas} titulo={titulo} />
      {selecionados.length > LIMITE ? (
        <p className="text-sm text-muted-foreground print:hidden">
          Mostrando as primeiras {LIMITE} de {selecionados.length}. Imprima por partes (escolha um armário de cada vez).
        </p>
      ) : null}
    </div>
  );
}
