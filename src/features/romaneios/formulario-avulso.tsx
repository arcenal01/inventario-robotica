"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SeletorOrigem } from "@/features/estoque/campos-endereco";
import type { ItemLista } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { SeletorItem } from "@/features/itens/seletor-item";
import { novaChave } from "@/lib/chave";
import { hojeBrasilia } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Linha = { chave: string; item: ItemLista; endereco: string; saldo: number; quantidade: string };

/** Romaneio sem pedido (ex.: kit para competição): escolhe item, de onde sai e quanto. */
export function FormularioAvulso() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const hoje = hojeBrasilia();

  function mudar(chave: string, campos: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)));
  }

  async function gerar() {
    setErro(null);
    if (descricao.trim().length < 3) return setErro("Descreva o romaneio (ex.: kit para a OBR).");
    if (linhas.length === 0) return setErro("Adicione pelo menos um item.");
    if (prazo && prazo < hoje) return setErro("O prazo não pode estar no passado.");

    // Soma por item + endereço: duas linhas do mesmo lugar não podem passar do saldo juntas
    const erros: Record<string, string> = {};
    const usado = new Map<string, number>();
    for (const l of linhas) {
      const n = Number(l.quantidade.replace(",", "."));
      const k = `${l.item.id}|${l.endereco}`;
      usado.set(k, (usado.get(k) ?? 0) + (Number.isFinite(n) ? n : 0));
      if (!l.endereco) erros[l.chave] = "Escolha de onde sai";
      else if (!Number.isFinite(n) || n <= 0) erros[l.chave] = "Quantidade maior que zero";
      else if (l.item.unidade === "un" && !Number.isInteger(n)) erros[l.chave] = 'Em "un" use número inteiro';
      else if ((usado.get(k) ?? 0) > l.saldo) erros[l.chave] = `Só há ${formatarQuantidade(l.saldo)} ${l.item.unidade} neste endereço`;
    }
    setErrosLinha(erros);
    if (Object.keys(erros).length > 0) return;

    setEnviando(true);
    const { data, error } = await criarClienteNavegador().rpc("gerar_romaneio_avulso", {
      p_descricao: descricao.trim(),
      p_itens: linhas.map((l) => ({ item_id: l.item.id, endereco_id: l.endereco, quantidade: Number(l.quantidade.replace(",", ".")) })),
      p_prazo_devolucao: prazo || undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await queryClient.invalidateQueries({ queryKey: ["romaneios"] });
    router.push(`/romaneios/${(data as { romaneio_id: string }).romaneio_id}`);
  }

  return (
    <div className="space-y-4">
      <Campo id="descricao" rotulo="Descrição">
        <Input id="descricao" placeholder="Ex.: kit para a OBR" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>
      <Campo id="prazo" rotulo="Devolver emprestáveis até (opcional)">
        <Input id="prazo" type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
      </Campo>

      <section className="space-y-2">
        <h2 className="font-semibold">Itens</h2>
        <SeletorItem
          id="adicionar-item"
          valor={null}
          aceitar={(i) => Number(i.saldo_total) > 0}
          aoMudar={(i) => {
            if (i) setLinhas((ls) => [...ls, { chave: novaChave(), item: i, endereco: "", saldo: 0, quantidade: "1" }]);
          }}
        />
        <ul className="space-y-2">
          {linhas.map((l) => (
            <li key={l.chave}>
              <Card>
                <CardContent className="space-y-2 p-3 sm:p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.item.nome}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{l.item.codigo}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>
                      Remover
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <SeletorOrigem
                        id={`origem-${l.chave}`}
                        itemId={l.item.id}
                        unidade={l.item.unidade}
                        valor={l.endereco}
                        aoMudar={(endereco, saldo) => mudar(l.chave, { endereco, saldo })}
                      />
                    </div>
                    <Input
                      aria-label={`Quantidade de ${l.item.codigo}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={l.quantidade}
                      onChange={(e) => mudar(l.chave, { quantidade: e.target.value })}
                    />
                  </div>
                  {errosLinha[l.chave] ? <p className="text-sm text-destructive">{errosLinha[l.chave]}</p> : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button onClick={() => void gerar()} disabled={enviando}>
          {enviando ? "Gerando..." : "Gerar romaneio"}
        </Button>
      </div>
    </div>
  );
}
