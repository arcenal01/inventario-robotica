"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent } from "@/components/ui/card";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { useItens } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { formatarDataHora } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { usePedido, type PedidoCompleto } from "./consultas";
import { COR_STATUS_PEDIDO, ROTULO_STATUS_PEDIDO, acoesDoPedido, quantidadesAlteradas } from "./regras";

type Janela = "aprovar" | "rejeitar" | "cancelar" | null;

function useAtualizar() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["pedidos", "romaneios", "notificacoes"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    );
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
      {texto}
    </p>
  ) : null;
}

/** Professor aprova; pode mudar a quantidade de cada item (0 tira o item do pedido). */
function DialogoAprovar({ pedido, aoFechar, aoConcluir }: { pedido: PedidoCompleto; aoFechar: () => void; aoConcluir: (m: string) => void }) {
  const atualizar = useAtualizar();
  const itensQ = useItens();
  const saldo = new Map((itensQ.data ?? []).map((i) => [i.id, Number(i.saldo_total)]));
  const [aprovadas, setAprovadas] = useState<Record<string, string>>(
    Object.fromEntries(pedido.itens.map((i) => [i.id, String(i.quantidade_solicitada)])),
  );
  const [comentario, setComentario] = useState("");
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aprovar() {
    setErro(null);
    const r = quantidadesAlteradas(
      pedido.itens.map((i) => ({ pedido_item_id: i.id, solicitada: i.quantidade_solicitada, aprovada: aprovadas[i.id] ?? "", unidade: i.item.unidade })),
    );
    if (!r.ok) return setErrosLinha(r.porLinha);
    setErrosLinha({});
    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("decidir_pedido", {
      p_pedido_id: pedido.id,
      p_aprovar: true,
      p_motivo: comentario.trim() || undefined,
      p_quantidades: r.lista.length > 0 ? r.lista : undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizar();
    aoConcluir(`Pedido ${pedido.codigo} aprovado.`);
  }

  return (
    <Dialogo aberto titulo={`Aprovar ${pedido.codigo}`} aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Ajuste as quantidades se precisar. 0 tira o item do pedido.</p>
        <ul className="space-y-2">
          {pedido.itens.map((i) => (
            <li key={i.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">{i.item.nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    pediu {formatarQuantidade(i.quantidade_solicitada)} · estoque {formatarQuantidade(saldo.get(i.item.id) ?? 0)}{" "}
                    {i.item.unidade}
                  </span>
                </span>
                <Input
                  className="w-24 shrink-0"
                  aria-label={`Quantidade aprovada de ${i.item.codigo}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={aprovadas[i.id] ?? ""}
                  onChange={(e) => setAprovadas((a) => ({ ...a, [i.id]: e.target.value }))}
                />
              </div>
              {errosLinha[i.id] ? <p className="text-sm text-destructive">{errosLinha[i.id]}</p> : null}
            </li>
          ))}
        </ul>
        <Campo id="comentario" rotulo="Comentário (opcional)">
          <Input id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </Campo>
        <Erro texto={erro} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void aprovar()} disabled={enviando}>
            {enviando ? "Aprovando..." : "Aprovar"}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Rejeitar (professor, motivo obrigatório) ou cancelar (dono ou professor, motivo opcional). */
function DialogoMotivo({ pedido, tipo, aoFechar, aoConcluir }: {
  pedido: PedidoCompleto; tipo: "rejeitar" | "cancelar"; aoFechar: () => void; aoConcluir: (m: string) => void;
}) {
  const atualizar = useAtualizar();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    if (tipo === "rejeitar" && motivo.trim().length < 3) return setErro("Explique o motivo para o aluno.");
    setEnviando(true);
    const supabase = criarClienteNavegador();
    const { error } =
      tipo === "rejeitar"
        ? await supabase.rpc("decidir_pedido", { p_pedido_id: pedido.id, p_aprovar: false, p_motivo: motivo.trim() })
        : await supabase.rpc("cancelar_pedido", { p_pedido_id: pedido.id, p_motivo: motivo.trim() || undefined });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizar();
    aoConcluir(tipo === "rejeitar" ? `Pedido ${pedido.codigo} rejeitado.` : `Pedido ${pedido.codigo} cancelado.`);
  }

  return (
    <Dialogo aberto titulo={tipo === "rejeitar" ? `Rejeitar ${pedido.codigo}` : `Cancelar ${pedido.codigo}`} aoFechar={aoFechar}>
      <div className="space-y-4">
        {tipo === "cancelar" && pedido.romaneios.some((r) => r.status !== "entregue" && r.status !== "cancelado") ? (
          <p className="text-sm text-amber-900">O romaneio aberto deste pedido também será cancelado.</p>
        ) : null}
        <Campo id="motivo" rotulo={tipo === "rejeitar" ? "Motivo (o aluno vai ver)" : "Motivo (opcional)"}>
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <Erro texto={erro} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={enviando}>
            {enviando ? "Enviando..." : tipo === "rejeitar" ? "Rejeitar" : "Cancelar pedido"}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Página do pedido: itens, histórico e as ações permitidas para quem está vendo. */
export function DetalhePedido({
  id,
  usuarioId,
  equipe,
  extraAcoes,
}: {
  id: string;
  usuarioId: string;
  equipe: boolean;
  /** Botões de outros módulos (ex.: romaneio, Bloco 11). */
  extraAcoes?: (pedido: PedidoCompleto) => ReactNode;
}) {
  const pedidoQ = usePedido(id);
  const atualizar = useAtualizar();
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (pedidoQ.isPending) return <p className="text-sm text-muted-foreground">Carregando pedido...</p>;
  if (pedidoQ.isError) return <Erro texto={`Não foi possível carregar o pedido: ${pedidoQ.error.message}`} />;
  const pedido = pedidoQ.data;
  if (!pedido) return <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>;

  const dono = pedido.solicitante_id === usuarioId;
  const acoes = acoesDoPedido(pedido.status, equipe, dono);
  const aprovadoMostra = ["aprovado", "separado", "entregue", "concluido"].includes(pedido.status);

  async function rpcSimples(nome: "enviar_pedido" | "concluir_pedido", mensagem: string) {
    setErro(null);
    setOcupado(true);
    const { error } = await criarClienteNavegador().rpc(nome, { p_pedido_id: pedido!.id });
    setOcupado(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizar();
    setAviso(mensagem);
  }

  const concluir = (m: string) => {
    setJanela(null);
    setAviso(m);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{pedido.codigo}</h1>
          <p className="text-sm text-muted-foreground">
            {pedido.solicitante?.nome ?? "?"}
            {pedido.solicitante?.turma ? ` · ${pedido.solicitante.turma}` : ""} · criado em {formatarDataHora(pedido.criado_em)}
          </p>
        </div>
        <Badge variant={COR_STATUS_PEDIDO[pedido.status]}>{ROTULO_STATUS_PEDIDO[pedido.status]}</Badge>
      </div>

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}
      <Erro texto={erro} />

      <Card>
        <CardContent className="space-y-1 p-4 text-sm sm:p-4">
          <p>
            <span className="text-muted-foreground">Finalidade:</span> {pedido.finalidade}
          </p>
          {pedido.projeto_turma ? (
            <p>
              <span className="text-muted-foreground">Projeto/turma:</span> {pedido.projeto_turma}
            </p>
          ) : null}
          {pedido.status === "rejeitado" && pedido.motivo_rejeicao ? (
            <p className="text-red-800">Motivo da rejeição: {pedido.motivo_rejeicao}</p>
          ) : null}
          {pedido.aprovado_em ? (
            <p className="text-muted-foreground">
              Aprovado em {formatarDataHora(pedido.aprovado_em)}
              {pedido.aprovador ? ` por ${pedido.aprovador.nome}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold">Itens</h2>
        <ul className="divide-y rounded-md border bg-card">
          {pedido.itens.map((i) => {
            const mudou = aprovadoMostra && i.quantidade_aprovada !== null && i.quantidade_aprovada !== i.quantidade_solicitada;
            return (
              <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.item.nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {i.item.codigo}
                    {i.item.tipo_controle === "emprestavel" ? " · emprestável" : ""}
                  </span>
                  {i.observacao ? <span className="block text-xs text-muted-foreground">{i.observacao}</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className={mudou ? "block text-xs text-muted-foreground line-through" : "block font-semibold"}>
                    {formatarQuantidade(i.quantidade_solicitada)} {i.item.unidade}
                  </span>
                  {mudou ? (
                    <span className="block font-semibold">
                      {i.quantidade_aprovada === 0 ? "não aprovado" : `${formatarQuantidade(i.quantidade_aprovada!)} ${i.item.unidade}`}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {pedido.romaneios.length > 0 ? (
        <section className="space-y-1">
          <h2 className="font-semibold">Romaneio</h2>
          <ul className="text-sm">
            {pedido.romaneios.map((r) => (
              <li key={r.id}>
                {equipe ? (
                  <Link href={`/romaneios/${r.id}`} className="font-mono text-primary hover:underline">
                    {r.codigo}
                  </Link>
                ) : (
                  <span className="font-mono">{r.codigo}</span>
                )}{" "}
                <span className="text-muted-foreground">({r.status.replace("_", " ")})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {acoes.includes("editar") ? (
          <Link
            href={`/pedidos/${pedido.id}/editar`}
            className="inline-flex h-11 items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent"
          >
            Editar
          </Link>
        ) : null}
        {acoes.includes("enviar") ? (
          <Button disabled={ocupado} onClick={() => void rpcSimples("enviar_pedido", "Pedido enviado para aprovação.")}>
            Enviar para aprovação
          </Button>
        ) : null}
        {acoes.includes("aprovar") ? <Button onClick={() => setJanela("aprovar")}>Aprovar</Button> : null}
        {acoes.includes("rejeitar") ? (
          <Button variant="outline" onClick={() => setJanela("rejeitar")}>
            Rejeitar
          </Button>
        ) : null}
        {extraAcoes && acoes.includes("gerar_romaneio") ? extraAcoes(pedido) : null}
        {acoes.includes("concluir") ? (
          <Button disabled={ocupado} onClick={() => void rpcSimples("concluir_pedido", "Pedido concluído.")}>
            Concluir pedido
          </Button>
        ) : null}
        {acoes.includes("cancelar") ? (
          <Button variant="ghost" onClick={() => setJanela("cancelar")}>
            Cancelar pedido
          </Button>
        ) : null}
      </div>
      {acoes.includes("concluir") ? (
        <p className="text-xs text-muted-foreground">Conclua quando todos os emprestáveis deste pedido forem devolvidos.</p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Histórico</h2>
        <ol className="space-y-1 border-l-2 pl-4 text-sm">
          {pedido.historico.map((h) => (
            <li key={h.id}>
              <span className="font-medium">{ROTULO_STATUS_PEDIDO[h.status_novo]}</span>{" "}
              <span className="text-muted-foreground">
                · {formatarDataHora(h.criado_em)}
                {h.usuario ? ` · ${h.usuario.nome}` : ""}
              </span>
              {h.comentario ? <span className="block text-xs text-muted-foreground">{h.comentario}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      {janela === "aprovar" ? <DialogoAprovar pedido={pedido} aoFechar={() => setJanela(null)} aoConcluir={concluir} /> : null}
      {janela === "rejeitar" || janela === "cancelar" ? (
        <DialogoMotivo pedido={pedido} tipo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />
      ) : null}
    </div>
  );
}
