"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import type { ItemLista } from "@/features/itens/consultas";
import { formatarQuantidade } from "@/features/itens/filtros";
import { SeletorItem } from "@/features/itens/seletor-item";
import { novaChave } from "@/lib/chave";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { SeletorOrigem, SeletorPosicao } from "./campos-endereco";
import { esquemaAjuste, esquemaEntrada, esquemaSaida, esquemaTransferencia, quantidadeValida } from "./schemas";

export type TipoOperacao = "entrada" | "saida" | "transferencia" | "ajuste";

const TITULO: Record<TipoOperacao, string> = {
  entrada: "Registrar entrada",
  saida: "Registrar saída (consumo)",
  transferencia: "Transferir entre endereços",
  ajuste: "Ajustar saldo",
};

const EXPLICACAO: Record<TipoOperacao, string> = {
  entrada: "Material que chegou na sala (compra, doação). Toda entrada vai para uma posição.",
  saida: "Baixa definitiva de material consumível (usado, quebrado na aula). Emprestáveis saem por empréstimo.",
  transferencia: "Mudar material de uma posição para outra. O total do item não muda.",
  ajuste: "Corrigir o saldo de uma posição para a quantidade que existe de verdade. Fica no histórico com o motivo.",
};

type Erros = Partial<Record<"item" | "origem" | "destino" | "endereco" | "quantidade" | "motivo", string>>;

function errosDoZod(e: ZodError): Erros {
  const saida: Erros = {};
  for (const issue of e.issues) {
    const campo = (issue.path[0] === "quantidade_nova" ? "quantidade" : issue.path[0]) as keyof Erros;
    saida[campo] ??= issue.message;
  }
  return saida;
}

/** Janela única para entrada, saída, transferência e ajuste (cada uma chama a função RPC certa). */
export function DialogoMovimento({
  tipo,
  itemInicial,
  aoFechar,
  aoConcluir,
}: {
  tipo: TipoOperacao;
  itemInicial?: ItemLista | null;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [chave] = useState(novaChave); // a mesma chave em todas as tentativas: reenvio não duplica
  const [item, setItem] = useState<ItemLista | null>(itemInicial ?? null);
  const [origem, setOrigem] = useState("");
  const [saldoOrigem, setSaldoOrigem] = useState<number | null>(null);
  const [destino, setDestino] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aceitar = tipo === "saida" ? (i: ItemLista) => i.tipo_controle === "consumivel" : undefined;
  const numero = quantidade.trim() === "" ? NaN : Number(quantidade.replace(",", "."));

  function trocarItem(novo: ItemLista | null) {
    setItem(novo);
    setOrigem("");
    setSaldoOrigem(null);
    setDestino("");
  }

  async function enviar() {
    setErro(null);
    if (!item) return setErros({ item: "Escolha o item" });

    let dados;
    if (tipo === "entrada") dados = esquemaEntrada.safeParse({ destino, quantidade: numero, motivo });
    else if (tipo === "saida") dados = esquemaSaida.safeParse({ origem, quantidade: numero, motivo });
    else if (tipo === "transferencia") dados = esquemaTransferencia.safeParse({ origem, destino, quantidade: numero, motivo });
    else dados = esquemaAjuste.safeParse({ endereco: destino, quantidade_nova: numero, motivo });
    if (!dados.success) return setErros(errosDoZod(dados.error));

    const problemaUnidade = quantidadeValida(numero, item.unidade);
    if (problemaUnidade) return setErros({ quantidade: problemaUnidade });
    if ((tipo === "saida" || tipo === "transferencia") && saldoOrigem !== null && numero > saldoOrigem) {
      return setErros({ quantidade: `Só há ${formatarQuantidade(saldoOrigem)} ${item.unidade} neste endereço` });
    }
    setErros({});

    setEnviando(true);
    const supabase = criarClienteNavegador();
    const m = motivo.trim() || undefined;
    const r =
      tipo === "entrada"
        ? await supabase.rpc("registrar_entrada", {
            p_item_id: item.id, p_endereco_id: destino, p_quantidade: numero, p_chave_idempotencia: chave, p_motivo: m,
          })
        : tipo === "saida"
          ? await supabase.rpc("registrar_saida", {
              p_item_id: item.id, p_endereco_id: origem, p_quantidade: numero, p_chave_idempotencia: chave, p_motivo: m,
            })
          : tipo === "transferencia"
            ? await supabase.rpc("transferir", {
                p_item_id: item.id, p_endereco_origem_id: origem, p_endereco_destino_id: destino,
                p_quantidade: numero, p_chave_idempotencia: chave, p_motivo: m,
              })
            : await supabase.rpc("ajustar", {
                p_item_id: item.id, p_endereco_id: destino, p_quantidade_nova: numero,
                p_motivo: motivo.trim(), p_chave_idempotencia: chave,
              });
    setEnviando(false);
    if (r.error) return setErro(traduzirErroBanco(r.error.message));

    await Promise.all(
      ["itens", "saldos", "movimentacoes"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    );
    const qtd = `${formatarQuantidade(numero)} ${item.unidade}`;
    aoConcluir(
      tipo === "entrada"
        ? `Entrada de ${qtd} de ${item.codigo} registrada.`
        : tipo === "saida"
          ? `Saída de ${qtd} de ${item.codigo} registrada.`
          : tipo === "transferencia"
            ? `${qtd} de ${item.codigo} transferido(s).`
            : `Saldo de ${item.codigo} ajustado para ${qtd}.`,
    );
  }

  return (
    <Dialogo aberto titulo={TITULO[tipo]} aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{EXPLICACAO[tipo]}</p>

        <Campo id="item" rotulo={tipo === "saida" ? "Item (só consumíveis)" : "Item"} erro={erros.item}>
          <SeletorItem id="item" valor={item} aoMudar={trocarItem} aceitar={aceitar} />
        </Campo>

        {item && (tipo === "saida" || tipo === "transferencia") ? (
          <Campo id="origem" rotulo="De onde sai" erro={erros.origem}>
            <SeletorOrigem
              id="origem"
              itemId={item.id}
              unidade={item.unidade}
              valor={origem}
              aoMudar={(id, saldo) => {
                setOrigem(id);
                setSaldoOrigem(saldo);
              }}
            />
          </Campo>
        ) : null}

        {item && tipo !== "saida" ? (
          <Campo
            id="destino"
            rotulo={tipo === "entrada" ? "Guardar em" : tipo === "transferencia" ? "Para onde vai" : "Posição ajustada"}
            erro={tipo === "ajuste" ? erros.endereco : erros.destino}
          >
            <SeletorPosicao
              id="destino"
              itemId={item.id}
              unidade={item.unidade}
              valor={destino}
              aoMudar={setDestino}
              excluir={tipo === "transferencia" ? origem : undefined}
            />
          </Campo>
        ) : null}

        {item ? (
          <Campo
            id="quantidade"
            rotulo={tipo === "ajuste" ? `Quantidade que existe de verdade (${item.unidade})` : `Quantidade (${item.unidade})`}
            erro={erros.quantidade}
          >
            <Input
              id="quantidade"
              type="number"
              inputMode={item.unidade === "un" ? "numeric" : "decimal"}
              min={0}
              step={item.unidade === "un" ? 1 : "any"}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </Campo>
        ) : null}

        {item ? (
          <Campo id="motivo" rotulo={tipo === "ajuste" ? "Motivo (obrigatório)" : "Motivo ou observação (opcional)"} erro={erros.motivo}>
            <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
        ) : null}

        {erro ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {erro}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={enviando || !item}>
            {enviando ? "Registrando..." : "Registrar"}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
