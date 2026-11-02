"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prepararContagem } from "@/features/contagens/regras";
import { useItens, type ItemLista } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { novaChave } from "@/lib/chave";
import { cn } from "@/lib/utils";
import { corrigirEnvio, descartarEnvio, reenviarEnvio, useFilaComEstado, useOffline } from "./fila";
import { dicaRecusa, type EnvioFila } from "./regras";

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

/**
 * Pendências (Bloco 15B): tudo que está guardado NESTE aparelho e ainda não chegou ao servidor.
 * Aguardando envio: enviar agora ou descartar. Recusadas: ver o motivo, corrigir, tentar de novo ou descartar.
 * Funciona sem conexão (só lê o IndexedDB e a cópia guardada dos itens).
 */
export function PainelPendencias() {
  const { fila, carregada } = useFilaComEstado();
  const { banco, sincronizar } = useOffline();
  const itensQ = useItens();
  const porId = useMemo(() => new Map((itensQ.data ?? []).map((i) => [i.id, i])), [itensQ.data]);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const pendentes = fila.filter((e) => e.estado === "pendente");
  const recusadas = fila.filter((e) => e.estado === "recusado");

  async function enviarAgora() {
    setMensagem(null);
    setEnviando(true);
    const r = await sincronizar();
    setEnviando(false);
    if (!r) return setMensagem({ tipo: "erro", texto: "Sem conexão agora. As contagens continuam guardadas e saem sozinhas quando a conexão voltar." });
    const restantes = banco ? await banco.fila.where("estado").equals("pendente").count() : 0;
    if (r.enviados === 0 && r.recusados === 0) {
      setMensagem({ tipo: "erro", texto: "O servidor não respondeu. As contagens continuam guardadas; tente de novo daqui a pouco." });
    } else {
      setMensagem({
        tipo: r.recusados > 0 ? "erro" : "ok",
        texto:
          `${r.enviados} enviada(s)` +
          (r.recusados > 0 ? `, ${r.recusados} recusada(s): veja abaixo.` : ".") +
          (restantes > 0 ? ` ${restantes} ainda aguardando.` : ""),
      });
    }
  }

  async function descartar(e: EnvioFila) {
    if (!banco) return;
    if (!window.confirm(`Descartar a contagem de ${e.enderecoCodigo}? O que foi contado nela será perdido.`)) return;
    await descartarEnvio(banco, e.chave);
    setMensagem({ tipo: "ok", texto: `Contagem de ${e.enderecoCodigo} descartada.` });
  }

  async function tentarDeNovo(e: EnvioFila) {
    if (!banco) return;
    await reenviarEnvio(banco, e.chave);
    await enviarAgora();
  }

  async function salvarCorrecao(e: EnvioFila, itens: EnvioFila["itens"]) {
    if (!banco) return;
    await corrigirEnvio(banco, e, itens, novaChave());
    await enviarAgora();
  }

  if (!carregada) return <p className="text-sm text-muted-foreground">Lendo o que está guardado neste aparelho...</p>;

  return (
    <div className="space-y-6">
      {mensagem ? (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={cn("rounded-md p-3 text-sm", mensagem.tipo === "erro" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900")}
        >
          {mensagem.texto}
        </p>
      ) : null}

      {fila.length === 0 ? (
        <Card>
          <CardContent className="space-y-1 p-5 sm:p-5">
            <p className="font-medium">Nada pendente neste aparelho.</p>
            <p className="text-sm text-muted-foreground">
              Tudo o que foi contado aqui já chegou ao servidor. Contagens feitas sem conexão aparecem nesta tela até serem enviadas.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {pendentes.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Aguardando envio ({pendentes.length})</h2>
            <Button size="sm" onClick={() => void enviarAgora()} disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar agora"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Saem sozinhas quando a conexão voltar. Não precisa fazer nada.</p>
          <ul className="space-y-2">
            {pendentes.map((e) => (
              <li key={e.chave}>
                <CartaoEnvio envio={e} porId={porId}>
                  <Button size="sm" variant="outline" onClick={() => void descartar(e)} disabled={enviando}>
                    Descartar
                  </Button>
                </CartaoEnvio>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recusadas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Recusadas pelo servidor ({recusadas.length})</h2>
          <p className="text-sm text-muted-foreground">
            O servidor não aceitou e nada delas foi gravado. Corrija e envie de novo, ou descarte.
          </p>
          <ul className="space-y-2">
            {recusadas.map((e) => (
              <li key={e.chave}>
                <Recusada
                  envio={e}
                  porId={porId}
                  ocupado={enviando}
                  aoDescartar={() => void descartar(e)}
                  aoTentarDeNovo={() => void tentarDeNovo(e)}
                  aoCorrigir={(itens) => salvarCorrecao(e, itens)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function nomeItem(porId: Map<string, ItemLista>, id: string) {
  const i = porId.get(id);
  return i ? { codigo: i.codigo, nome: i.nome, unidade: i.unidade as string } : { codigo: id.slice(0, 8), nome: "Item", unidade: "" };
}

function CartaoEnvio({
  envio,
  porId,
  destaque,
  children,
}: {
  envio: EnvioFila;
  porId: Map<string, ItemLista>;
  destaque?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-base font-semibold">{envio.enderecoCodigo}</p>
            <p className="text-xs text-muted-foreground">
              <Link href={`/contagens/${envio.contagemId}`} className="text-primary hover:underline">
                {envio.contagemCodigo}
              </Link>{" "}
              · contado em {new Date(envio.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
          {envio.estado === "pendente" ? <Badge variant="warning">Aguardando envio</Badge> : <Badge variant="danger">Recusada</Badge>}
        </div>
        <ul className="divide-y rounded-md border text-sm">
          {envio.itens.map((l) => {
            const i = nomeItem(porId, l.item_id);
            return (
              <li key={l.item_id} className={cn("flex justify-between gap-2 px-3 py-1.5", destaque === i.codigo && "bg-red-50 text-red-800")}>
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{i.codigo}</span> {i.nome}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatarQuantidade(l.quantidade)} {i.unidade}
                </span>
              </li>
            );
          })}
        </ul>
        {children ? <div className="flex flex-wrap justify-end gap-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function Recusada({
  envio,
  porId,
  ocupado,
  aoDescartar,
  aoTentarDeNovo,
  aoCorrigir,
}: {
  envio: EnvioFila;
  porId: Map<string, ItemLista>;
  ocupado: boolean;
  aoDescartar: () => void;
  aoTentarDeNovo: () => void;
  aoCorrigir: (itens: EnvioFila["itens"]) => Promise<void>;
}) {
  const dica = dicaRecusa(envio.motivo);
  const [corrigindo, setCorrigindo] = useState(false);

  return (
    <div className="space-y-2">
      <CartaoEnvio envio={envio} porId={porId} destaque={dica.codigoItem}>
        {!corrigindo ? (
          <>
            <Button size="sm" variant="outline" onClick={aoDescartar} disabled={ocupado}>
              Descartar
            </Button>
            <Button size="sm" variant="outline" onClick={aoTentarDeNovo} disabled={ocupado}>
              Tentar de novo
            </Button>
            {dica.podeCorrigir ? (
              <Button size="sm" onClick={() => setCorrigindo(true)} disabled={ocupado}>
                Corrigir
              </Button>
            ) : null}
          </>
        ) : null}
      </CartaoEnvio>
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
        <p>
          <span className="font-semibold">Motivo:</span> {envio.motivo}
        </p>
        <p className="mt-1">{dica.texto}</p>
      </div>
      {corrigindo ? (
        <FormCorrecao
          envio={envio}
          porId={porId}
          destaque={dica.codigoItem}
          ocupado={ocupado}
          aoCancelar={() => setCorrigindo(false)}
          aoSalvar={async (itens) => {
            await aoCorrigir(itens);
            setCorrigindo(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Corrigir: muda as quantidades; deixar em branco tira o item do envio (igual à tela de contar). */
function FormCorrecao({
  envio,
  porId,
  destaque,
  ocupado,
  aoCancelar,
  aoSalvar,
}: {
  envio: EnvioFila;
  porId: Map<string, ItemLista>;
  destaque: string | null;
  ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: (itens: EnvioFila["itens"]) => Promise<void>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      envio.itens.map((l) => [l.item_id, nomeItem(porId, l.item_id).codigo === destaque ? "" : String(l.quantidade).replace(".", ",")]),
    ),
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const r = prepararContagem(
      envio.itens.map((l) => ({ item_id: l.item_id, unidade: nomeItem(porId, l.item_id).unidade, valor: valores[l.item_id] ?? "" })),
    );
    if (!r.ok) {
      setErros(r.porItem);
      if (r.geral) setErro("Todos os itens ficaram em branco. Para não enviar nada, use Descartar.");
      return;
    }
    setErros({});
    await aoSalvar(r.itens);
  }

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4 sm:p-4">
        <p className="text-sm font-medium">Corrigir {envio.enderecoCodigo}</p>
        <p className="text-xs text-muted-foreground">Deixe em branco o item que deve sair do envio. 0 = procurou e não achou.</p>
        <ul className="space-y-2">
          {envio.itens.map((l) => {
            const i = nomeItem(porId, l.item_id);
            return (
              <li key={l.item_id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{i.nome}</span>
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      {i.codigo}
                      {i.codigo === destaque ? <Badge variant="danger">Motivo da recusa</Badge> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Input
                      className="w-24"
                      aria-label={`Quantidade corrigida de ${i.codigo}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={valores[l.item_id] ?? ""}
                      onChange={(ev) => setValores((v) => ({ ...v, [l.item_id]: ev.target.value }))}
                    />
                    <span className="w-6 text-xs text-muted-foreground">{i.unidade}</span>
                  </span>
                </div>
                {erros[l.item_id] ? <p className="text-sm text-destructive">{erros[l.item_id]}</p> : null}
              </li>
            );
          })}
        </ul>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void salvar()} disabled={ocupado}>
            Salvar e enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
