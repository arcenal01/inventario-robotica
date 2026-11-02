"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEnderecos } from "@/features/enderecos/consultas";
import type { ItemLista } from "@/features/itens/consultas";
import { SeletorItem } from "@/features/itens/seletor-item";
import { resolverEndereco } from "@/features/leitor/codigo-endereco";
import { CampoCodigo } from "@/features/leitor/leitor-qr";
import { enfileirar, useFila, useOffline } from "@/features/offline/fila";
import { eFalhaTemporaria, itensNaFila, type EnvioFila } from "@/features/offline/regras";
import { novaChave } from "@/lib/chave";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { useContagem, useItensParaContar, usePosicoesDaContagem, type ItemParaContar } from "./consultas";
import { podeContarItem, prepararContagem, recebeContagens } from "./regras";

type NovoEnvio = Omit<EnvioFila, "criadoEm" | "estado" | "motivo" | "tentativas">;
type EtiquetaAntiga = { antigo: string; atual: { id: string; codigo: string }; naContagem: boolean };

/** Mantém o endereço escolhido na URL (recarregar a página não perde a posição), sem ir ao servidor. */
function marcarNaUrl(contagemId: string, enderecoId: string | null) {
  window.history.replaceState(null, "", `/contagens/${contagemId}/contar${enderecoId ? `?endereco=${enderecoId}` : ""}`);
}

/**
 * Contar uma posição: lê o QR (ou digita o código) do endereço, mostra os itens esperados SEM a quantidade
 * do sistema e grava tudo de uma vez em registrar_contagem (uma chamada = uma posição, com chave de idempotência).
 * Sem conexão (Bloco 15A): a posição contada fica guardada na fila do aparelho, com a MESMA chave, e é enviada depois.
 */
export function ContarPosicao({ contagemId, enderecoInicial }: { contagemId: string; enderecoInicial: string | null }) {
  const queryClient = useQueryClient();
  const contagemQ = useContagem(contagemId);
  const posicoesQ = usePosicoesDaContagem(contagemId);
  const enderecosQ = useEnderecos();
  const [enderecoId, setEnderecoId] = useState<string | null>(enderecoInicial);
  // Sem conexão, o service worker entrega a cópia guardada de /contar SEM o ?endereco=: lê da barra de endereço
  useEffect(() => {
    if (enderecoInicial) return;
    const daUrl = new URLSearchParams(window.location.search).get("endereco");
    if (daUrl) setEnderecoId(daUrl);
  }, [enderecoInicial]);
  const itensQ = useItensParaContar(contagemId, enderecoId);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<ItemParaContar[]>([]);
  const [errosItem, setErrosItem] = useState<Record<string, string>>({});
  const [chave, setChave] = useState(novaChave); // reaproveitada se a mesma posição for reenviada (não conta duas vezes)
  const [etiquetaAntiga, setEtiquetaAntiga] = useState<EtiquetaAntiga | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { banco, sincronizar } = useOffline();
  const fila = useFila();
  const daContagem = fila.filter((e) => e.contagemId === contagemId);
  const naFila = useMemo(() => itensNaFila(fila, contagemId, enderecoId), [fila, contagemId, enderecoId]);

  const posicao = (posicoesQ.data ?? []).find((p) => p.endereco_id === enderecoId) ?? null;
  const itens = useMemo(() => itensQ.data ?? [], [itensQ.data]);
  // itens já guardados na fila deste aparelho não aparecem para contar de novo
  const contaveis = useMemo(
    () => [...itens.filter((i) => podeContarItem(i.situacao) && !naFila.has(i.item_id)), ...extras],
    [itens, extras, naFila],
  );
  const jaContados = itens.filter((i) => !podeContarItem(i.situacao) || naFila.has(i.item_id));
  const naLista = useMemo(() => new Set([...itens, ...extras].map((i) => i.item_id)), [itens, extras]);

  if (contagemQ.fetchStatus === "paused" && !contagemQ.data) return <SemDadosGuardados />;
  if (contagemQ.isPending || posicoesQ.isPending) return <p className="text-sm text-muted-foreground">Carregando contagem...</p>;
  // com cópia guardada no aparelho, a tela segue funcionando mesmo se a atualização falhar (sem conexão)
  if (contagemQ.isError && !contagemQ.data) return <p className="text-sm text-red-800">Erro: {traduzirErroBanco(contagemQ.error.message)}</p>;
  if (posicoesQ.isError && !posicoesQ.data) return <p className="text-sm text-red-800">Erro: {traduzirErroBanco(posicoesQ.error.message)}</p>;
  const cnt = contagemQ.data;
  if (!cnt) return <p className="text-sm text-muted-foreground">Contagem não encontrada.</p>;
  if (!recebeContagens(cnt.status)) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        A contagem {cnt.codigo} não está recebendo contagens agora (está {cnt.status === "em_revisao" ? "em revisão" : "encerrada"}).
      </p>
    );
  }
  const naContagem = (id: string) => (posicoesQ.data ?? []).some((p) => p.endereco_id === id);

  function escolher(id: string | null) {
    setEnderecoId(id);
    setValores({});
    setExtras([]);
    setErrosItem({});
    setEtiquetaAntiga(null);
    setErro(null);
    setChave(novaChave());
    marcarNaUrl(contagemId, id);
  }

  function aoCodigo(codigo: string) {
    setErro(null);
    setAviso(null);
    setEtiquetaAntiga(null);
    const r = resolverEndereco(enderecosQ.data ?? [], codigo);
    if (r.tipo === "vazio") return;
    if (r.tipo === "nao_encontrado") return setErro(`Código ${r.codigo} não encontrado. Confira a etiqueta.`);
    if (r.tipo === "substituido") {
      return setEtiquetaAntiga({ antigo: r.antigo.codigo, atual: r.atual, naContagem: naContagem(r.atual.id) });
    }
    if (!naContagem(r.endereco.id)) {
      return setErro(
        r.tipo === "inativo"
          ? `O endereço ${r.endereco.codigo} está desativado e não faz parte desta contagem.`
          : `${r.endereco.codigo} não é uma posição desta contagem. Leia a etiqueta da posição (o último nível do endereço).`,
      );
    }
    escolher(r.endereco.id);
  }

  async function registrar() {
    setErro(null);
    setAviso(null);
    const r = prepararContagem(contaveis.map((i) => ({ item_id: i.item_id, unidade: i.unidade, valor: valores[i.item_id] ?? "" })));
    if (!r.ok) {
      setErrosItem(r.porItem);
      if (r.geral) setErro(r.geral);
      return;
    }
    setErrosItem({});
    setEnviando(true);
    const envio: NovoEnvio = {
      chave,
      tipo: "contagem",
      contagemId,
      contagemCodigo: cnt?.codigo ?? "",
      enderecoId: enderecoId ?? "",
      enderecoCodigo: posicao?.codigo ?? "",
      itens: r.itens,
    };
    if (!navigator.onLine) return guardarNoAparelho(envio, r.emBranco);
    const { data, error, status } = await criarClienteNavegador().rpc("registrar_contagem", {
      p_contagem_id: contagemId,
      p_endereco_id: enderecoId ?? "",
      p_itens: r.itens,
      p_chave_idempotencia: chave,
    });
    // rede caiu ou servidor fora no meio do envio: guarda com a mesma chave (se chegou, o reenvio vira "duplicada")
    if (error && eFalhaTemporaria(status, error.message)) return guardarNoAparelho(envio, r.emBranco);
    setEnviando(false);
    // Atualiza a lista mesmo com erro: outra pessoa pode ter contado um item desta posição agora há pouco
    await queryClient.invalidateQueries({ queryKey: ["contagens", contagemId] });
    if (error) return setErro(traduzirErroBanco(error.message));
    const codigo = posicao?.codigo ?? "";
    const duplicada = (data as { duplicada?: boolean } | null)?.duplicada;
    escolher(null);
    setAviso(
      duplicada
        ? `A contagem de ${codigo} já tinha sido registrada (reenvio). Abra a posição de novo para ver o que ainda falta.`
        : `${codigo}: ${r.itens.length} item(ns) registrado(s).${r.emBranco > 0 ? ` ${r.emBranco} ficaram em branco e continuam pendentes.` : ""} Leia a próxima posição.`,
    );
  }

  async function guardarNoAparelho(envio: NovoEnvio, emBranco: number) {
    if (!banco) {
      setEnviando(false);
      return setErro("Sem conexão, e este navegador não consegue guardar a contagem. Tente de novo quando a conexão voltar.");
    }
    try {
      await enfileirar(banco, envio);
    } catch {
      setEnviando(false);
      return setErro("Não foi possível guardar a contagem neste aparelho (memória cheia?). Tente de novo com conexão.");
    }
    setEnviando(false);
    escolher(null);
    setAviso(
      `${envio.enderecoCodigo}: ${envio.itens.length} item(ns) guardado(s) neste aparelho, sem conexão. Serão enviados sozinhos quando a conexão voltar.` +
        `${emBranco > 0 ? ` ${emBranco} ficaram em branco e continuam pendentes.` : ""} Leia a próxima posição.`,
    );
  }

  if (!enderecoId) {
    return (
      <div className="space-y-4">
        {aviso ? (
          <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            {aviso}
          </p>
        ) : null}
        <CampoCodigo id="codigo-posicao" rotulo="Código da posição" exemplo="ARM01-GAV01-P01" aoConfirmar={aoCodigo} />
        {etiquetaAntiga ? (
          <div role="alert" className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Etiqueta antiga: <span className="font-mono font-semibold">{etiquetaAntiga.antigo}</span> foi trocado por{" "}
              <span className="font-mono font-semibold">{etiquetaAntiga.atual.codigo}</span>. Avise o professor para trocar a etiqueta.
            </p>
            {etiquetaAntiga.naContagem ? (
              <Button size="sm" onClick={() => escolher(etiquetaAntiga.atual.id)}>
                Contar {etiquetaAntiga.atual.codigo}
              </Button>
            ) : (
              <p>O endereço novo não faz parte desta contagem.</p>
            )}
          </div>
        ) : null}
        {erro ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {erro}
          </p>
        ) : null}
        {daContagem.length > 0 ? <GuardadosNoAparelho envios={daContagem} aoEnviar={sincronizar} /> : null}
        <p className="text-xs text-muted-foreground">
          Também dá para tocar na posição na{" "}
          <Link href={`/contagens/${contagemId}`} className="text-primary hover:underline">
            página da contagem
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Contando a posição</p>
          <p className="font-mono text-xl font-semibold">{posicao?.codigo ?? "..."}</p>
          {posicao?.nome ? <p className="text-sm text-muted-foreground">{posicao.nome}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => escolher(null)}>
          Trocar posição
        </Button>
      </div>

      {itensQ.isPending && itensQ.fetchStatus === "paused" ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Sem conexão, e os itens desta posição não foram guardados neste aparelho. Abra a contagem uma vez com conexão antes de contar
          offline.
        </p>
      ) : itensQ.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando itens...</p>
      ) : null}
      {itensQ.isError && !itensQ.data ? <p className="text-sm text-red-800">Erro: {traduzirErroBanco(itensQ.error.message)}</p> : null}

      {itensQ.data ? (
        <>
          <p className="text-sm">
            Conte o que está <span className="font-semibold">fisicamente</span> nesta posição. Deixe em branco o que não contou agora; use 0 se
            procurou e não achou.
          </p>
          {contaveis.length === 0 ? (
            <p className="rounded-md bg-secondary p-3 text-sm">Nada para contar aqui. Se achou um item que não está na lista, adicione abaixo.</p>
          ) : null}
          <ul className="space-y-2">
            {contaveis.map((i) => (
              <li key={i.item_id}>
                <Card>
                  <CardContent className="space-y-1 p-3 sm:p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{i.nome}</span>
                        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          {i.codigo}
                          {i.situacao === "recontar" ? <Badge variant="danger">Recontagem</Badge> : null}
                          {extras.some((x) => x.item_id === i.item_id) ? <Badge>Achado a mais</Badge> : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Input
                          className="w-24"
                          aria-label={`Quantidade contada de ${i.codigo}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={valores[i.item_id] ?? ""}
                          onChange={(e) => setValores((v) => ({ ...v, [i.item_id]: e.target.value }))}
                        />
                        <span className="w-6 text-xs text-muted-foreground">{i.unidade}</span>
                      </span>
                    </div>
                    {errosItem[i.item_id] ? <p className="text-sm text-destructive">{errosItem[i.item_id]}</p> : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="space-y-1">
            <p className="text-sm font-medium">Achou um item que não está na lista?</p>
            <SeletorItem
              id="item-extra"
              valor={null}
              mostrarSaldo={false}
              aceitar={(item: ItemLista) =>
                !naLista.has(item.id) && (cnt.escopo !== "por_categoria" || item.categoria_id === cnt.categoria_id)
              }
              aoMudar={(item) => {
                if (item) {
                  setExtras((x) => [...x, { item_id: item.id, codigo: item.codigo, nome: item.nome, unidade: item.unidade, situacao: "contar" }]);
                }
              }}
            />
          </div>

          {jaContados.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Já contados nesta posição</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {jaContados.map((i) => (
                  <li key={i.item_id} className="flex justify-between gap-2 rounded-md border px-3 py-2">
                    <span className="truncate">{i.nome}</span>
                    <span className="shrink-0 text-xs">
                      {naFila.has(i.item_id)
                        ? "guardado neste aparelho (falta enviar)"
                        : i.situacao === "recontar_outro"
                          ? "você contou: outra pessoa reconta"
                          : "já contado"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {erro ? (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {erro}
            </p>
          ) : null}
          <Button className="w-full" onClick={() => void registrar()} disabled={enviando || contaveis.length === 0}>
            {enviando ? "Registrando..." : "Registrar contagem desta posição"}
          </Button>
          <p className="text-xs text-muted-foreground">Depois de registrar, só o professor pode pedir recontagem (feita por outra pessoa).</p>
        </>
      ) : null}
    </div>
  );
}

function SemDadosGuardados() {
  return (
    <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      Sem conexão, e esta contagem ainda não foi guardada neste aparelho. Abra o app com conexão uma vez (ele guarda as contagens abertas
      sozinho) e tente de novo.
    </p>
  );
}

/** Posições contadas sem conexão, ainda neste aparelho: aguardando envio ou recusadas pelo servidor (com o motivo). */
function GuardadosNoAparelho({ envios, aoEnviar }: { envios: EnvioFila[]; aoEnviar: () => Promise<unknown> }) {
  const [enviando, setEnviando] = useState(false);
  const pendentes = envios.filter((e) => e.estado === "pendente").length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Guardadas neste aparelho</p>
        {pendentes > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              await aoEnviar();
              setEnviando(false);
            }}
          >
            {enviando ? "Enviando..." : "Enviar agora"}
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1 text-sm">
        {envios.map((e) => (
          <li key={e.chave} className="space-y-1 rounded-md border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold">{e.enderecoCodigo}</span>
              {e.estado === "pendente" ? <Badge variant="warning">Aguardando envio</Badge> : <Badge variant="danger">Recusada</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{e.itens.length} item(ns) contado(s)</p>
            {e.motivo ? <p className="text-xs text-red-800">Motivo: {e.motivo}</p> : null}
          </li>
        ))}
      </ul>
      {envios.some((e) => e.estado === "recusado") ? (
        <p className="text-xs text-muted-foreground">
          Para corrigir ou descartar as recusadas, abra{" "}
          <Link href="/pendencias" className="text-primary hover:underline">
            Pendências
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
