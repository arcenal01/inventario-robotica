"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { DetalhePedido } from "@/features/pedidos/detalhe-pedido";
import type { PedidoCompleto } from "@/features/pedidos/consultas";
import { hojeBrasilia } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";

/** Gera o romaneio do pedido aprovado (o banco escolhe os endereços com mais saldo primeiro). */
function BotaoGerarRomaneio({ pedido }: { pedido: PedidoCompleto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const temEmprestavel = pedido.itens.some((i) => i.item.tipo_controle === "emprestavel" && (i.quantidade_aprovada ?? 0) > 0);
  const hoje = hojeBrasilia();

  async function gerar() {
    setErro(null);
    if (prazo && prazo < hoje) return setErro("O prazo não pode estar no passado.");
    setEnviando(true);
    const { data, error } = await criarClienteNavegador().rpc("gerar_romaneio_do_pedido", {
      p_pedido_id: pedido.id,
      p_prazo_devolucao: prazo || undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await Promise.all(["pedidos", "romaneios"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    router.push(`/romaneios/${(data as { romaneio_id: string }).romaneio_id}`);
  }

  return (
    <>
      <Button onClick={() => (temEmprestavel ? setAberto(true) : void gerar())} disabled={enviando}>
        {enviando ? "Gerando..." : "Gerar romaneio"}
      </Button>
      {erro && !aberto ? (
        <p role="alert" className="w-full rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}
      {aberto ? (
        <Dialogo aberto titulo="Gerar romaneio" aoFechar={() => setAberto(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O pedido tem itens emprestáveis. Se quiser, informe até quando devem voltar (vale para os empréstimos criados na entrega).
            </p>
            <Campo id="prazo" rotulo="Devolver até (opcional)">
              <Input id="prazo" type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Campo>
            {erro ? (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {erro}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Voltar
              </Button>
              <Button onClick={() => void gerar()} disabled={enviando}>
                {enviando ? "Gerando..." : "Gerar"}
              </Button>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </>
  );
}

/** Página do pedido com o botão de romaneio (o módulo de pedidos não depende do de romaneios). */
export function PedidoComRomaneio(props: { id: string; usuarioId: string; equipe: boolean }) {
  return <DetalhePedido {...props} extraAcoes={(pedido) => <BotaoGerarRomaneio pedido={pedido} />} />;
}
