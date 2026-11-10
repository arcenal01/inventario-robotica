"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { idsComDescendentes, type Endereco, type TipoEndereco } from "./arvore";
import { esquemaMoverEndereco, esquemaResultadoMover, type DadosMoverEndereco } from "./schemas";

/**
 * Mover um endereço = troca de QR. O banco cria endereços novos (com tudo que está dentro),
 * transfere o estoque e abre uma requisição para trocar as etiquetas.
 */
export function DialogoMover({
  endereco,
  enderecos,
  tipos,
  aoFechar,
  aoConcluir,
}: {
  endereco: Endereco | null;
  enderecos: Endereco[];
  tipos: TipoEndereco[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  if (!endereco) return null;
  return (
    <Dialogo aberto titulo="Mover endereço (troca de QR)" aoFechar={aoFechar}>
      <Formulario endereco={endereco} enderecos={enderecos} tipos={tipos} aoFechar={aoFechar} aoConcluir={aoConcluir} />
    </Dialogo>
  );
}

function Formulario({
  endereco,
  enderecos,
  tipos,
  aoFechar,
  aoConcluir,
}: {
  endereco: Endereco;
  enderecos: Endereco[];
  tipos: TipoEndereco[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const { destinos, afetados } = useMemo(() => {
    const tipo = tipos.find((t) => t.id === endereco.tipo_endereco_id);
    const dentro = idsComDescendentes(enderecos, endereco.id);
    const tiposPorId = new Map(tipos.map((t) => [t.id, t]));
    const validos = enderecos.filter((e) => {
      const t = tiposPorId.get(e.tipo_endereco_id);
      return (
        e.ativo &&
        !dentro.has(e.id) &&
        e.id !== endereco.pai_id &&
        t !== undefined &&
        !t.armazena_itens &&
        tipo !== undefined &&
        t.nivel < tipo.nivel
      );
    });
    const ativosDentro = enderecos.filter((e) => dentro.has(e.id) && e.ativo).length;
    return { destinos: validos, afetados: ativosDentro };
  }, [endereco, enderecos, tipos]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosMoverEndereco>({
    resolver: zodResolver(esquemaMoverEndereco),
    defaultValues: { novo_pai_id: "", motivo: "" },
  });

  async function aoEnviar(dados: DadosMoverEndereco) {
    setErro(null);
    const { data, error } = await criarClienteNavegador().rpc("mover_endereco", {
      p_endereco_id: endereco.id,
      p_novo_pai_id: dados.novo_pai_id,
      p_motivo: dados.motivo || undefined,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    const resultado = esquemaResultadoMover.safeParse(data);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["enderecos"] }),
      queryClient.invalidateQueries({ queryKey: ["trocas_qr"] }),
    ]);
    aoConcluir(
      resultado.success
        ? `${resultado.data.codigo_antigo} agora é ${resultado.data.codigo_novo}. ${resultado.data.etiquetas} etiqueta(s) para trocar.`
        : "Endereço movido. Veja as trocas de QR pendentes.",
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <p className="text-sm">
        Mover <span className="font-mono font-semibold">{endereco.codigo}</span>
        {endereco.nome ? ` (${endereco.nome})` : ""}.
      </p>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        O QR muda: serão criados {afetados} endereço(s) novo(s), com códigos novos. O estoque é transferido automaticamente e as
        etiquetas antigas deixam de valer. Professores e administradores recebem o aviso para trocar as etiquetas.
      </p>

      <Campo id="novo_pai_id" rotulo="Novo lugar (dentro de)" erro={errors.novo_pai_id?.message}>
        <Select id="novo_pai_id" {...register("novo_pai_id")}>
          <option value="">Escolha...</option>
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo}
              {d.nome ? ` - ${d.nome}` : ""}
            </option>
          ))}
        </Select>
      </Campo>
      {destinos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Não há outro lugar válido para este endereço.</p>
      ) : null}
      <Campo id="motivo" rotulo="Motivo (opcional)" erro={errors.motivo?.message}>
        <Input id="motivo" {...register("motivo")} />
      </Campo>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || destinos.length === 0}>
          {isSubmitting ? "Movendo..." : "Mover e gerar novos QR"}
        </Button>
      </div>
    </form>
  );
}
