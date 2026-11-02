import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  MapPin,
  Package,
  QrCode,
  ScanLine,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROTULO_MOVIMENTACAO } from "@/features/estoque/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { COR_STATUS_PEDIDO, ROTULO_STATUS_PEDIDO } from "@/features/pedidos/regras";
import { exigirAprovado } from "@/lib/auth/perfil";
import { formatarDataHora } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

/** Número grande do painel, com ícone e link. "alerta" pinta de amarelo quando há algo a resolver. */
function Indicador({
  href,
  Icone,
  numero,
  rotulo,
  detalhe,
  alerta = false,
}: {
  href: string;
  Icone: LucideIcon;
  numero: number;
  rotulo: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <Card className={cn("h-full p-4 pressionar-suave group-hover:border-primary/50 group-hover:bg-accent", alerta && "border-amber-300/60")}>
        <div className="flex items-start justify-between gap-2">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", alerta ? "bg-amber-100 text-amber-900" : "bg-accent text-primary")}>
            <Icone className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{numero}</p>
        <p className="text-sm font-medium">{rotulo}</p>
        {detalhe ? <p className={cn("text-xs", alerta ? "text-amber-900" : "text-muted-foreground")}>{detalhe}</p> : null}
      </Card>
    </Link>
  );
}

/** Cartão de atalho com ícone, título, texto e (opcional) contador. */
function Atalho({ href, Icone, titulo, texto, contador }: { href: string; Icone: LucideIcon; titulo: string; texto: string; contador?: string }) {
  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "flex h-full items-center gap-4 p-4 pressionar-suave group-hover:border-primary/50 group-hover:bg-accent",
          contador && "border-amber-300/60",
        )}
      >
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", contador ? "bg-amber-100 text-amber-900" : "bg-accent text-primary")}>
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          <span className="block text-sm text-muted-foreground">{texto}</span>
        </span>
        {contador ? <Badge variant="warning">{contador}</Badge> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </Card>
    </Link>
  );
}

function Secao({ titulo, href, rotuloLink, children }: { titulo: string; href: string; rotuloLink: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {rotuloLink}
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

const contar = (r: { count: number | null }) => r.count ?? 0;

/** Painel do Início: números do dia e listas curtas. A RLS já limita o que o aluno vê (só os próprios pedidos e empréstimos). */
export default async function PaginaInicio() {
  const perfil = await exigirAprovado();
  const equipe = perfil.perfil !== "aluno";
  const supabase = await criarClienteServidor();
  const n = { count: "exact" as const, head: true };

  const [abaixo, listaAbaixo, abertos, atrasados, contagens, aguardando, emAndamento, cadastros, trocas, movs, meusPedidos] = await Promise.all([
    supabase.from("vw_itens_estoque").select("id", n).eq("abaixo_minimo", true),
    supabase
      .from("vw_itens_estoque")
      .select("id, codigo, nome, unidade, saldo_total, estoque_minimo")
      .eq("abaixo_minimo", true)
      .order("saldo_total")
      .limit(5),
    supabase.from("vw_emprestimos_abertos").select("id", n),
    supabase.from("vw_emprestimos_atrasados").select("id", n),
    supabase.from("contagens").select("id", n).in("status", ["aberta", "em_andamento", "em_revisao"]),
    supabase.from("pedidos").select("id", n).eq("status", "enviado"),
    supabase.from("pedidos").select("id", n).in("status", ["enviado", "aprovado", "separado", "entregue"]),
    equipe ? supabase.from("perfis").select("id", n).eq("status_cadastro", "pendente") : Promise.resolve({ count: 0 }),
    equipe ? supabase.from("trocas_qr").select("id", n).eq("status", "pendente") : Promise.resolve({ count: 0 }),
    equipe
      ? supabase
          .from("movimentacoes")
          .select(
            `id, tipo, quantidade, criado_em,
             item:itens!movimentacoes_item_id_fkey(nome, unidade),
             usuario:perfis!movimentacoes_usuario_id_fkey(nome)`,
          )
          .order("criado_em", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: null }),
    equipe
      ? Promise.resolve({ data: null })
      : supabase
          .from("pedidos")
          .select("id, codigo, status, finalidade, atualizado_em")
          .not("status", "in", "(rascunho,concluido,cancelado,rejeitado)")
          .order("atualizado_em", { ascending: false })
          .limit(5),
  ]);

  const nAbaixo = contar(abaixo);
  const nAtrasados = contar(atrasados);
  const nContagens = contar(contagens);
  const nAguardando = contar(aguardando);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Painel</p>
        <h1 className="text-2xl font-semibold md:text-3xl">Olá, {perfil.nome.split(" ")[0]}!</h1>
        <p className="text-sm text-muted-foreground">Resumo da sala de robótica agora.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        <Indicador href="/itens" Icone={AlertTriangle} numero={nAbaixo} rotulo="Abaixo do mínimo" detalhe={nAbaixo > 0 ? "Repor estoque" : "Tudo em ordem"} alerta={nAbaixo > 0} />
        <Indicador
          href="/pedidos"
          Icone={ClipboardList}
          numero={equipe ? nAguardando : contar(emAndamento)}
          rotulo={equipe ? "Pedidos para aprovar" : "Meus pedidos em andamento"}
          detalhe={equipe ? `${contar(emAndamento)} em andamento no total` : undefined}
          alerta={equipe && nAguardando > 0}
        />
        <Indicador
          href="/emprestimos"
          Icone={ArrowLeftRight}
          numero={contar(abertos)}
          rotulo={equipe ? "Empréstimos em aberto" : "Meus empréstimos"}
          detalhe={nAtrasados > 0 ? `${nAtrasados} atrasado(s)` : "Nenhum atrasado"}
          alerta={nAtrasados > 0}
        />
        <Indicador
          href="/contagens"
          Icone={ScanLine}
          numero={nContagens}
          rotulo="Contagens em andamento"
          detalhe={nContagens > 0 ? "Ajude a contar" : "Nenhuma agora"}
          alerta={nContagens > 0}
        />
      </section>

      {contar(cadastros) > 0 || contar(trocas) > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {contar(cadastros) > 0 ? (
            <Atalho href="/usuarios" Icone={Users} titulo="Cadastros pendentes" texto="Aprovar acesso de alunos." contador={String(contar(cadastros))} />
          ) : null}
          {contar(trocas) > 0 ? (
            <Atalho href="/enderecos/trocas" Icone={QrCode} titulo="Trocar etiquetas de QR" texto="Endereços mudaram de lugar." contador={String(contar(trocas))} />
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <Secao titulo="Abaixo do estoque mínimo" href="/itens" rotuloLink="Ver itens">
          {(listaAbaixo.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum item abaixo do mínimo.</p>
          ) : (
            <ul className="divide-y">
              {(listaAbaixo.data ?? []).map((i) => {
                const saldo = Number(i.saldo_total ?? 0);
                const minimo = Number(i.estoque_minimo ?? 0);
                const pct = minimo > 0 ? Math.min(100, Math.round((saldo / minimo) * 100)) : 0;
                return (
                  <li key={i.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{i.nome}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatarQuantidade(saldo)} / {formatarQuantidade(minimo)} {i.unidade}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                      <div className="h-full rounded-full bg-amber-900/80" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>

        {equipe ? (
          <Secao titulo="Últimas movimentações" href="/movimentacoes" rotuloLink="Ver histórico">
            {(movs.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="divide-y">
                {(movs.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.item?.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatarDataHora(m.criado_em)}
                        {m.usuario ? ` · ${m.usuario.nome}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Badge>{ROTULO_MOVIMENTACAO[m.tipo]}</Badge>
                      <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                        {formatarQuantidade(Number(m.quantidade))} {m.item?.unidade}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        ) : (
          <Secao titulo="Meus pedidos em andamento" href="/pedidos" rotuloLink="Ver pedidos">
            {(meusPedidos.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhum pedido em andamento.{" "}
                <Link href="/pedidos/novo" className="text-primary hover:underline">
                  Fazer um pedido
                </Link>
              </p>
            ) : (
              <ul className="divide-y">
                {(meusPedidos.data ?? []).map((p) => (
                  <li key={p.id}>
                    <Link href={`/pedidos/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/50">
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-semibold">{p.codigo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.finalidade}</span>
                      </span>
                      <Badge variant={COR_STATUS_PEDIDO[p.status]}>{ROTULO_STATUS_PEDIDO[p.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atalhos</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Atalho href="/pedidos/novo" Icone={ClipboardList} titulo="Novo pedido" texto="Pedir material para um projeto." />
          <Atalho href="/itens" Icone={Package} titulo="Itens" texto="Consultar materiais e saldos." />
          {equipe ? (
            <Atalho href="/relatorios" Icone={FileSpreadsheet} titulo="Relatórios" texto="CSV e PDF de estoque, movimentações, empréstimos e divergências." />
          ) : (
            <Atalho href="/enderecos" Icone={MapPin} titulo="Endereços" texto="Armários, gavetas, caixas e etiquetas." />
          )}
        </div>
      </section>
    </div>
  );
}
