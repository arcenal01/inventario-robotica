"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { compararCodigos } from "@/features/enderecos/arvore";
import { useEnderecos } from "@/features/enderecos/consultas";
import { useCategorias } from "@/features/itens/consultas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { EscopoContagem } from "./regras";

/** Abrir contagem (professor/admin): estoque inteiro, um endereço (com tudo dentro) ou uma categoria. */
export function DialogoNovaContagem({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enderecosQ = useEnderecos();
  const categoriasQ = useCategorias();
  const [escopo, setEscopo] = useState<EscopoContagem>("geral");
  const [enderecoId, setEnderecoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enderecos = useMemo(() => (enderecosQ.data ?? []).filter((e) => e.ativo).sort(compararCodigos), [enderecosQ.data]);
  const categorias = (categoriasQ.data ?? []).filter((c) => c.ativa);

  async function abrir() {
    setErro(null);
    if (escopo === "por_endereco" && !enderecoId) return setErro("Escolha o endereço que será contado.");
    if (escopo === "por_categoria" && !categoriaId) return setErro("Escolha a categoria que será contada.");
    setEnviando(true);
    const { data, error } = await criarClienteNavegador().rpc("abrir_contagem", {
      p_escopo: escopo,
      p_endereco_id: escopo === "por_endereco" ? enderecoId : undefined,
      p_categoria_id: escopo === "por_categoria" ? categoriaId : undefined,
      p_observacao: observacao.trim() || undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await queryClient.invalidateQueries({ queryKey: ["contagens"] });
    const id = (data as { contagem_id: string }).contagem_id;
    router.push(`/contagens/${id}`);
  }

  return (
    <Dialogo aberto titulo="Nova contagem" aoFechar={aoFechar}>
      <div className="space-y-4">
        <Campo id="escopo" rotulo="O que contar">
          <Select id="escopo" value={escopo} onChange={(e) => setEscopo(e.target.value as EscopoContagem)}>
            <option value="geral">Estoque inteiro (todas as posições)</option>
            <option value="por_endereco">Um endereço e tudo que está dentro</option>
            <option value="por_categoria">Uma categoria (em todas as posições)</option>
          </Select>
        </Campo>

        {escopo === "por_endereco" ? (
          <Campo id="endereco" rotulo="Endereço">
            <Select id="endereco" value={enderecoId} onChange={(e) => setEnderecoId(e.target.value)}>
              <option value="">{enderecosQ.isPending ? "Carregando..." : "Escolha"}</option>
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo}
                  {e.nome ? ` · ${e.nome}` : ""}
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}

        {escopo === "por_categoria" ? (
          <Campo id="categoria" rotulo="Categoria">
            <Select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">{categoriasQ.isPending ? "Carregando..." : "Escolha"}</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.prefixo})
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}

        <Campo id="observacao" rotulo="Observação (opcional)">
          <Input id="observacao" value={observacao} maxLength={200} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: inventário do 1º semestre" />
        </Campo>

        <p className="text-xs text-muted-foreground">
          Alunos, professores e admin podem contar. Cada item em cada posição é contado por uma pessoa; se houver divergência, você pede
          recontagem (feita por outra pessoa) e só depois aprova os ajustes.
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
          <Button onClick={() => void abrir()} disabled={enviando}>
            {enviando ? "Abrindo..." : "Abrir contagem"}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
