"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Endereco, TipoEndereco } from "./arvore";
import {
  esquemaEditarEndereco,
  esquemaNovoEndereco,
  type DadosEditarEndereco,
  type DadosNovoEndereco,
} from "./schemas";

type Props =
  | { modo: "novo"; pai: Endereco | null; tipos: TipoEndereco[]; aoFechar: () => void; aoConcluir: (mensagem: string) => void }
  | { modo: "editar"; endereco: Endereco; aoFechar: () => void; aoConcluir: (mensagem: string) => void };

function FormularioNovo({
  pai,
  tipos,
  aoFechar,
  aoConcluir,
}: {
  pai: Endereco | null;
  tipos: TipoEndereco[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const tipoDoPai = pai ? tipos.find((t) => t.id === pai.tipo_endereco_id) : undefined;

  // Raiz: só tipos de nível 1. Dentro de um pai: só tipos de nível maior que o do pai.
  const permitidos = tipos.filter((t) => t.ativo && (tipoDoPai ? t.nivel > tipoDoPai.nivel : t.nivel === 1));

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DadosNovoEndereco>({
    resolver: zodResolver(esquemaNovoEndereco),
    defaultValues: { tipo_endereco_id: permitidos[0]?.id ?? "", nome: "", descricao: "", quantidade: 1 },
  });

  const tipoEscolhido = tipos.find((t) => t.id === watch("tipo_endereco_id"));

  const criar = useMutation({
    mutationFn: async (dados: DadosNovoEndereco) => {
      const linhas = Array.from({ length: dados.quantidade }, () => ({
        tipo_endereco_id: dados.tipo_endereco_id,
        pai_id: pai?.id ?? null,
        nome: dados.nome || null,
        descricao: dados.descricao || null,
      }));
      const { data, error } = await criarClienteNavegador().from("enderecos").insert(linhas).select("codigo");
      if (error) throw new Error(error.message);
      return (data ?? []).map((l) => l.codigo).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    },
  });

  async function aoEnviar(dados: DadosNovoEndereco) {
    setErro(null);
    try {
      const codigos = await criar.mutateAsync(dados);
      await queryClient.invalidateQueries({ queryKey: ["enderecos"] });
      aoConcluir(
        codigos.length === 1 ? `Endereço criado: ${codigos[0]}.` : `${codigos.length} endereços criados: ${codigos[0]} até ${codigos[codigos.length - 1]}.`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar.");
    }
  }

  if (permitidos.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Não há tipo de endereço disponível para este nível. O administrador pode criar tipos em Endereços, Tipos de endereço.
        </p>
        <Button variant="outline" onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        {pai ? (
          <>
            Dentro de <span className="font-mono font-semibold">{pai.codigo}</span>. O código é gerado automaticamente.
          </>
        ) : (
          "Endereço de primeiro nível. O código é gerado automaticamente."
        )}
      </p>
      <Campo id="tipo_endereco_id" rotulo="Tipo" erro={errors.tipo_endereco_id?.message}>
        <Select id="tipo_endereco_id" {...register("tipo_endereco_id")}>
          {permitidos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} ({t.prefixo}){t.armazena_itens ? " - guarda itens" : ""}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo id="nome" rotulo="Nome (opcional)" erro={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Campo>
      <Campo id="descricao" rotulo="Descrição (opcional)" erro={errors.descricao?.message}>
        <Input id="descricao" {...register("descricao")} />
      </Campo>
      <Campo id="quantidade" rotulo="Quantos criar de uma vez?" erro={errors.quantidade?.message}>
        <Input id="quantidade" type="number" inputMode="numeric" min={1} max={50} {...register("quantidade", { valueAsNumber: true })} />
      </Campo>
      {tipoEscolhido?.armazena_itens ? (
        <p className="text-xs text-muted-foreground">Este tipo é uma posição: é onde os itens ficam guardados.</p>
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Criar"}
        </Button>
      </div>
    </form>
  );
}

function FormularioEditar({
  endereco,
  aoFechar,
  aoConcluir,
}: {
  endereco: Endereco;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosEditarEndereco>({
    resolver: zodResolver(esquemaEditarEndereco),
    defaultValues: { nome: endereco.nome ?? "", descricao: endereco.descricao ?? "" },
  });

  async function aoEnviar(dados: DadosEditarEndereco) {
    setErro(null);
    const { data, error } = await criarClienteNavegador()
      .from("enderecos")
      .update({ nome: dados.nome || null, descricao: dados.descricao || null })
      .eq("id", endereco.id)
      .select("id");
    if (error) {
      setErro(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setErro("Sem permissão ou endereço não encontrado.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["enderecos"] });
    aoConcluir(`Endereço ${endereco.codigo} atualizado.`);
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        O código <span className="font-mono font-semibold">{endereco.codigo}</span> não muda. Para mudar o lugar do endereço, use o
        botão Mover.
      </p>
      <Campo id="nome" rotulo="Nome" erro={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Campo>
      <Campo id="descricao" rotulo="Descrição" erro={errors.descricao?.message}>
        <Input id="descricao" {...register("descricao")} />
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Janela para criar um endereço (ou vários) ou editar nome e descrição. */
export function DialogoEndereco({ configuracao: props }: { configuracao: Props | null }) {
  if (!props) return null;
  const titulo = props.modo === "novo" ? (props.pai ? "Novo endereço dentro" : "Novo endereço") : "Editar endereço";
  return (
    <Dialogo aberto titulo={titulo} aoFechar={props.aoFechar}>
      {props.modo === "novo" ? (
        <FormularioNovo pai={props.pai} tipos={props.tipos} aoFechar={props.aoFechar} aoConcluir={props.aoConcluir} />
      ) : (
        <FormularioEditar endereco={props.endereco} aoFechar={props.aoFechar} aoConcluir={props.aoConcluir} />
      )}
    </Dialogo>
  );
}
