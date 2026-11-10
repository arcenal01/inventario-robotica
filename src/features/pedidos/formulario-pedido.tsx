"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useItens } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { SeletorItem } from "@/features/itens/seletor-item";
import { novaChave } from "@/lib/chave";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { PedidoCompleto } from "./consultas";
import { prepararItens, type LinhaCarrinho } from "./regras";

/** Cria um pedido novo ou edita um rascunho. "Enviar" manda para aprovação do professor. */
export function FormularioPedido({ pedido, turmaPadrao }: { pedido: PedidoCompleto | null; turmaPadrao: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const itensQ = useItens();
  const [chave] = useState(novaChave); // reenvio do mesmo pedido novo não cria outro
  const [finalidade, setFinalidade] = useState(pedido?.finalidade ?? "");
  const [projeto, setProjeto] = useState(pedido?.projeto_turma ?? turmaPadrao ?? "");
  const [linhas, setLinhas] = useState<LinhaCarrinho[]>(
    (pedido?.itens ?? []).map((i) => ({
      item_id: i.item.id,
      codigo: i.item.codigo,
      unidade: i.item.unidade,
      quantidade: String(i.quantidade_solicitada),
      observacao: i.observacao ?? "",
    })),
  );
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [erroFinalidade, setErroFinalidade] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"salvar" | "enviar" | null>(null);

  const porId = new Map((itensQ.data ?? []).map((i) => [i.id, i]));

  function mudarLinha(itemId: string, campo: "quantidade" | "observacao", valor: string) {
    setLinhas((ls) => ls.map((l) => (l.item_id === itemId ? { ...l, [campo]: valor } : l)));
  }

  async function salvar(enviar: boolean) {
    setErro(null);
    const f = finalidade.trim();
    setErroFinalidade(f.length < 3 ? "Conte para que é o material (ex.: projeto do robô seguidor de linha)" : f.length > 200 ? "Máximo 200 caracteres" : null);
    const preparado = prepararItens(linhas);
    setErrosLinha(preparado.ok ? {} : preparado.porLinha);
    if (!preparado.ok && preparado.geral) setErro(preparado.geral);
    if (f.length < 3 || f.length > 200 || !preparado.ok) return;
    if (projeto.trim().length > 60) return setErro("Projeto ou turma: máximo 60 caracteres");

    setEnviando(enviar ? "enviar" : "salvar");
    const { data, error } = await criarClienteNavegador().rpc("salvar_pedido", {
      p_chave_idempotencia: chave,
      p_finalidade: f,
      p_itens: preparado.itens,
      p_projeto_turma: projeto.trim() || undefined,
      p_enviar: enviar,
      p_pedido_id: pedido?.id,
    });
    setEnviando(null);
    if (error) return setErro(traduzirErroBanco(error.message));
    const id = (data as { pedido_id: string }).pedido_id;
    await queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    router.push(`/pedidos/${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Campo id="finalidade" rotulo="Para que é o material?" erro={erroFinalidade ?? undefined}>
        <Input id="finalidade" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
      </Campo>
      <Campo id="projeto" rotulo="Projeto ou turma (opcional)">
        <Input id="projeto" value={projeto} onChange={(e) => setProjeto(e.target.value)} />
      </Campo>

      <section className="space-y-2">
        <h2 className="font-semibold">Itens</h2>
        <SeletorItem
          id="adicionar-item"
          valor={null}
          aceitar={(i) => !linhas.some((l) => l.item_id === i.id)}
          aoMudar={(i) => {
            if (!i) return;
            setLinhas((ls) => [...ls, { item_id: i.id, codigo: i.codigo, unidade: i.unidade, quantidade: "1", observacao: "" }]);
          }}
        />
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Busque acima e toque no item para adicionar.</p>
        ) : null}
        <ul className="space-y-2">
          {linhas.map((l) => {
            const item = porId.get(l.item_id);
            const n = Number(l.quantidade.replace(",", "."));
            const passa = item && Number.isFinite(n) && n > Number(item.saldo_total);
            return (
              <li key={l.item_id}>
                <Card>
                  <CardContent className="space-y-2 p-3 sm:p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item?.nome ?? l.codigo}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {l.codigo}
                          {item ? ` · ${formatarQuantidade(item.saldo_total)} ${l.unidade} em estoque` : ""}
                          {item?.tipo_controle === "emprestavel" ? " · emprestável (volta)" : ""}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover ${l.codigo}`}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.item_id !== l.item_id))}
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        aria-label={`Quantidade de ${l.codigo}`}
                        type="number"
                        inputMode={l.unidade === "un" ? "numeric" : "decimal"}
                        min={0}
                        value={l.quantidade}
                        onChange={(e) => mudarLinha(l.item_id, "quantidade", e.target.value)}
                      />
                      <Input
                        className="col-span-2"
                        aria-label={`Observação de ${l.codigo}`}
                        placeholder="Observação (opcional)"
                        value={l.observacao}
                        onChange={(e) => mudarLinha(l.item_id, "observacao", e.target.value)}
                      />
                    </div>
                    {errosLinha[l.item_id] ? <p className="text-sm text-destructive">{errosLinha[l.item_id]}</p> : null}
                    {passa ? (
                      <p className="text-xs text-amber-900">Mais do que há em estoque agora: o professor pode ajustar na aprovação.</p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button variant="outline" disabled={enviando !== null} onClick={() => void salvar(false)}>
          {enviando === "salvar" ? "Salvando..." : "Salvar rascunho"}
        </Button>
        <Button disabled={enviando !== null} onClick={() => void salvar(true)}>
          {enviando === "enviar" ? "Enviando..." : "Enviar para aprovação"}
        </Button>
      </div>
    </div>
  );
}
