"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent } from "@/components/ui/card";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePessoasAprovadas } from "@/features/estoque/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { novaChave } from "@/lib/chave";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useRomaneio, type RomaneioCompleto } from "./consultas";
import {
  COR_STATUS_ROMANEIO,
  ROTULO_STATUS_ROMANEIO,
  agruparPorEstrutura,
  podeCancelar,
  podeSeparar,
  prepararConferencia,
} from "./regras";

function useAtualizar() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["romaneios", "pedidos", "itens", "saldos", "emprestimos", "movimentacoes", "notificacoes"].map((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

/** Entrega: quem recebe + quanto foi conferido em cada linha. Consumível vira saída; emprestável vira empréstimo. */
function DialogoEntrega({ romaneio, aoFechar, aoConcluir }: { romaneio: RomaneioCompleto; aoFechar: () => void; aoConcluir: (m: string) => void }) {
  const atualizar = useAtualizar();
  const pessoasQ = usePessoasAprovadas();
  const [chave] = useState(novaChave); // mesma chave em toda tentativa: a entrega nunca baixa duas vezes
  const [recebedor, setRecebedor] = useState(romaneio.pedido?.solicitante_id ?? "");
  const [conferidas, setConferidas] = useState<Record<string, string>>(
    Object.fromEntries(romaneio.itens.map((l) => [l.id, String(l.quantidade)])),
  );
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const linhas = agruparPorEstrutura(romaneio.itens).flatMap((g) => g.linhas);
  const temEmprestavel = romaneio.itens.some((l) => l.item.tipo_controle === "emprestavel");

  async function entregar() {
    setErro(null);
    if (!recebedor) return setErro("Escolha quem recebeu o material.");
    const r = prepararConferencia(
      linhas.map((l) => ({ id: l.id, quantidade: l.quantidade, conferida: conferidas[l.id] ?? "", unidade: l.item.unidade })),
    );
    if (!r.ok) {
      setErrosLinha(r.porLinha);
      if (r.geral) setErro(r.geral);
      return;
    }
    setErrosLinha({});
    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("entregar_romaneio", {
      p_romaneio_id: romaneio.id,
      p_recebido_por: recebedor,
      p_chave_idempotencia: chave,
      p_conferencias: r.conferencias,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizar();
    aoConcluir(`Romaneio ${romaneio.codigo} entregue.`);
  }

  return (
    <Dialogo aberto titulo={`Entregar ${romaneio.codigo}`} aoFechar={aoFechar}>
      <div className="space-y-4">
        <Campo id="recebedor" rotulo="Quem recebeu">
          <Select id="recebedor" value={recebedor} onChange={(e) => setRecebedor(e.target.value)}>
            <option value="">{pessoasQ.isPending ? "Carregando..." : "Escolha"}</option>
            {(pessoasQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.turma ? ` · ${p.turma}` : ""}
              </option>
            ))}
          </Select>
        </Campo>
        <div className="space-y-2">
          <p className="text-sm font-medium">Conferência (só o conferido é entregue)</p>
          {linhas.map((l) => (
            <div key={l.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{l.item.nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {l.endereco.codigo} · separado {formatarQuantidade(l.quantidade)} {l.item.unidade}
                  </span>
                </span>
                <Input
                  className="w-24 shrink-0"
                  aria-label={`Conferido de ${l.item.codigo} em ${l.endereco.codigo}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={conferidas[l.id] ?? ""}
                  onChange={(e) => setConferidas((c) => ({ ...c, [l.id]: e.target.value }))}
                />
              </div>
              {errosLinha[l.id] ? <p className="text-sm text-destructive">{errosLinha[l.id]}</p> : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Consumíveis saem do estoque. Emprestáveis viram empréstimo para quem recebeu
          {romaneio.prazo_devolucao ? `, com devolução até ${formatarData(romaneio.prazo_devolucao)}` : temEmprestavel ? ", sem prazo" : ""}.
          Se o saldo mudou desde a separação, nada é baixado e aparece o erro.
        </p>
        {erro ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {erro}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void entregar()} disabled={enviando}>
            {enviando ? "Entregando..." : "Confirmar entrega"}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Página do romaneio: checklist de separação por local, entrega com conferência e cancelamento. */
export function DetalheRomaneio({ id }: { id: string }) {
  const romaneioQ = useRomaneio(id);
  const atualizar = useAtualizar();
  const [entregando, setEntregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const grupos = useMemo(() => agruparPorEstrutura(romaneioQ.data?.itens ?? []), [romaneioQ.data]);

  if (romaneioQ.isPending) return <p className="text-sm text-muted-foreground">Carregando romaneio...</p>;
  if (romaneioQ.isError) return <p className="text-sm text-red-800">Erro: {romaneioQ.error.message}</p>;
  const rom = romaneioQ.data;
  if (!rom) return <p className="text-sm text-muted-foreground">Romaneio não encontrado.</p>;

  const separando = podeSeparar(rom.status);
  const feitos = rom.itens.filter((l) => l.separado).length;

  async function chamar(acao: string, fn: () => PromiseLike<{ error: { message: string } | null }>, mensagem?: string) {
    setErro(null);
    setOcupado(acao);
    const { error } = await fn();
    setOcupado(null);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizar();
    if (mensagem) setAviso(mensagem);
  }

  const supabase = criarClienteNavegador();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{rom.codigo}</h1>
          <p className="text-sm text-muted-foreground">
            {rom.pedido ? (
              <>
                Pedido{" "}
                <Link href={`/pedidos/${rom.pedido.id}`} className="font-mono text-primary hover:underline">
                  {rom.pedido.codigo}
                </Link>{" "}
                · {rom.pedido.solicitante?.nome ?? "?"}
              </>
            ) : (
              `Avulso: ${rom.descricao ?? ""}`
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Gerado em {formatarDataHora(rom.criado_em)}
            {rom.criador ? ` por ${rom.criador.nome}` : ""}
            {rom.prazo_devolucao ? ` · devolução até ${formatarData(rom.prazo_devolucao)}` : ""}
          </p>
        </div>
        <Badge variant={COR_STATUS_ROMANEIO[rom.status]}>{ROTULO_STATUS_ROMANEIO[rom.status]}</Badge>
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

      {separando ? (
        <p className="text-sm">
          Separação: <span className="font-semibold">{feitos}</span> de {rom.itens.length} linhas. Toque em cada linha quando pegar o
          material.
        </p>
      ) : null}

      {grupos.map((g) => (
        <section key={g.estrutura} className="space-y-1">
          <h2 className="font-mono text-sm font-semibold text-muted-foreground">{g.estrutura}</h2>
          <ul className="space-y-2">
            {g.linhas.map((l) => (
              <li key={l.id}>
                <Card className={cn(l.separado && "border-emerald-300 bg-emerald-50/50")}>
                  <CardContent className="p-0 sm:p-0">
                    <button
                      type="button"
                      disabled={!separando || ocupado !== null}
                      onClick={() =>
                        void chamar(l.id, () =>
                          supabase.rpc("marcar_item_separado", { p_romaneio_item_id: l.id, p_separado: !l.separado }),
                        )
                      }
                      className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
                      aria-pressed={l.separado}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-sm font-bold",
                          l.separado ? "border-emerald-600 bg-emerald-600 text-white" : "border-input",
                        )}
                      >
                        {l.separado ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-semibold">{l.endereco.codigo}</span>
                        <span className="block truncate text-sm">{l.item.nome}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {l.item.codigo}
                          {l.item.tipo_controle === "emprestavel" ? " · emprestável" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-semibold">
                          {formatarQuantidade(l.quantidade)} {l.item.unidade}
                        </span>
                        {rom.status === "entregue" && l.quantidade_conferida !== null && l.quantidade_conferida !== l.quantidade ? (
                          <span className="block text-xs text-amber-900">entregue {formatarQuantidade(l.quantidade_conferida)}</span>
                        ) : null}
                      </span>
                    </button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {rom.status === "entregue" ? (
        <p className="text-sm text-muted-foreground">
          Entregue em {formatarDataHora(rom.entregue_em)} para {rom.recebedor?.nome ?? "?"}
          {rom.separador ? ` · separado por ${rom.separador.nome}` : ""}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {separando ? (
          <Button
            disabled={feitos < rom.itens.length || ocupado !== null}
            onClick={() =>
              void chamar("concluir", () => supabase.rpc("concluir_separacao", { p_romaneio_id: rom.id }), "Separação concluída.")
            }
          >
            Concluir separação
          </Button>
        ) : null}
        {rom.status === "separado" ? <Button onClick={() => setEntregando(true)}>Entregar</Button> : null}
        <Link
          href={`/romaneios/${rom.id}/imprimir`}
          className="inline-flex h-11 items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent"
        >
          Imprimir / PDF
        </Link>
        {podeCancelar(rom.status) ? (
          <Button
            variant="ghost"
            disabled={ocupado !== null}
            onClick={() => {
              if (window.confirm(`Cancelar o romaneio ${rom.codigo}?${rom.pedido ? ' O pedido volta para "Aprovado".' : ""}`)) {
                void chamar("cancelar", () => supabase.rpc("cancelar_romaneio", { p_romaneio_id: rom.id }), "Romaneio cancelado.");
              }
            }}
          >
            Cancelar romaneio
          </Button>
        ) : null}
      </div>
      {separando && feitos < rom.itens.length ? (
        <p className="text-xs text-muted-foreground">Conclua a separação depois de marcar todas as linhas.</p>
      ) : null}

      {entregando ? (
        <DialogoEntrega
          romaneio={rom}
          aoFechar={() => setEntregando(false)}
          aoConcluir={(m) => {
            setEntregando(false);
            setAviso(m);
          }}
        />
      ) : null}
    </div>
  );
}
