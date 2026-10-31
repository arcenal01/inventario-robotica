"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Categoria, ItemLista } from "./consultas";
import { apagarFoto, enviarFoto, reduzirFoto, urlFoto } from "./foto";
import {
  ROTULO_TIPO_CONTROLE,
  ROTULO_UNIDADE,
  TIPOS_CONTROLE,
  UNIDADES,
  esquemaItem,
  especificacoesParaJson,
  jsonParaEspecificacoes,
  type DadosItem,
} from "./schemas";

type FotoNova = { blob: Blob; previa: string };

function traduzirErro(mensagem: string): string {
  if (mensagem.includes("row-level security")) return "Sem permissão para salvar itens.";
  return mensagem;
}

function FormularioItem({
  item,
  categorias,
  aoFechar,
  aoConcluir,
}: {
  item: ItemLista | null;
  categorias: Categoria[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [fotoNova, setFotoNova] = useState<FotoNova | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  // Unidade e tipo de controle só mudam enquanto o item não tem estoque (o banco também confere).
  const travado = Boolean(item && (Number(item.saldo_total) > 0 || Number(item.emprestado_em_aberto) > 0));
  const opcoesCategoria = categorias.filter((c) => c.ativa || c.id === item?.categoria_id);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosItem>({
    resolver: zodResolver(esquemaItem),
    defaultValues: {
      nome: item?.nome ?? "",
      categoria_id: item?.categoria_id ?? opcoesCategoria[0]?.id ?? "",
      unidade: item?.unidade ?? "un",
      tipo_controle: item?.tipo_controle ?? "consumivel",
      descricao: item?.descricao ?? "",
      estoque_minimo: Number(item?.estoque_minimo ?? 0),
      especificacoes: jsonParaEspecificacoes(item?.especificacoes),
      ativo: item ? item.status === "ativo" : true,
    },
  });
  const especificacoes = useFieldArray({ control, name: "especificacoes" });

  // Libera a memória da prévia quando troca de foto ou fecha a janela
  useEffect(() => () => (fotoNova ? URL.revokeObjectURL(fotoNova.previa) : undefined), [fotoNova]);

  async function aoEscolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setProcessandoFoto(true);
    try {
      const blob = await reduzirFoto(arquivo);
      setFotoNova({ blob, previa: URL.createObjectURL(blob) });
      setRemoverFoto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a foto.");
    } finally {
      setProcessandoFoto(false);
    }
  }

  async function aoEnviar(dados: DadosItem) {
    setErro(null);
    const supabase = criarClienteNavegador();
    const campos = {
      nome: dados.nome,
      categoria_id: dados.categoria_id,
      unidade: dados.unidade,
      tipo_controle: dados.tipo_controle,
      descricao: dados.descricao || null,
      estoque_minimo: dados.estoque_minimo,
      especificacoes: especificacoesParaJson(dados.especificacoes),
      status: dados.ativo ? ("ativo" as const) : ("inativo" as const),
    };

    // 1) Grava os dados (o código é gerado pelo banco no cadastro)
    let id: string;
    let codigo: string;
    if (item) {
      const { data, error } = await supabase.from("itens").update(campos).eq("id", item.id).select("id, codigo");
      if (error) return setErro(traduzirErro(error.message));
      if (!data || data.length === 0) return setErro("Sem permissão ou item não encontrado.");
      ({ id, codigo } = data[0]);
    } else {
      const { data, error } = await supabase.from("itens").insert(campos).select("id, codigo").single();
      if (error) return setErro(traduzirErro(error.message));
      ({ id, codigo } = data);
    }

    // 2) Foto: envia a nova (ou remove) e só depois apaga a antiga
    let avisoFoto = "";
    const fotoAntiga = item?.foto_url ?? null;
    try {
      if (fotoNova) {
        const caminho = await enviarFoto(id, fotoNova.blob);
        const { error } = await supabase.from("itens").update({ foto_url: caminho }).eq("id", id);
        if (error) throw new Error(error.message);
        await apagarFoto(fotoAntiga);
      } else if (removerFoto && fotoAntiga) {
        const { error } = await supabase.from("itens").update({ foto_url: null }).eq("id", id);
        if (error) throw new Error(error.message);
        await apagarFoto(fotoAntiga);
      }
    } catch (e) {
      avisoFoto = ` A foto não foi salva (${e instanceof Error ? e.message : "erro"}): edite o item para tentar de novo.`;
    }

    await queryClient.invalidateQueries({ queryKey: ["itens"] });
    aoConcluir((item ? `Item ${codigo} atualizado.` : `Item cadastrado com o código ${codigo}.`) + avisoFoto);
  }

  const fotoAtual = removerFoto ? null : fotoNova?.previa ?? urlFoto(item?.foto_url);

  if (opcoesCategoria.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Cadastre uma categoria antes (Itens, Categorias).</p>
        <Button variant="outline" onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      {item ? (
        <p className="text-sm text-muted-foreground">
          Código <span className="font-mono font-semibold">{item.codigo}</span>: não muda, nem trocando a categoria.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">O código (ex.: SEN-001) é gerado automaticamente pelo prefixo da categoria.</p>
      )}

      <Campo id="nome" rotulo="Nome" erro={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Campo>
      <Campo id="categoria_id" rotulo="Categoria" erro={errors.categoria_id?.message}>
        <Select id="categoria_id" {...register("categoria_id")}>
          {opcoesCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.prefixo})
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="unidade" rotulo="Unidade" erro={errors.unidade?.message}>
          <Select id="unidade" disabled={travado} {...register("unidade")}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {ROTULO_UNIDADE[u]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo id="estoque_minimo" rotulo="Estoque mínimo (0 = sem alerta)" erro={errors.estoque_minimo?.message}>
          <Input
            id="estoque_minimo"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            {...register("estoque_minimo", { valueAsNumber: true })}
          />
        </Campo>
      </div>
      <Campo id="tipo_controle" rotulo="Tipo de controle" erro={errors.tipo_controle?.message}>
        <Select id="tipo_controle" disabled={travado} {...register("tipo_controle")}>
          {TIPOS_CONTROLE.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_CONTROLE[t]}
            </option>
          ))}
        </Select>
      </Campo>
      {travado ? (
        <p className="text-xs text-muted-foreground">
          Este item tem estoque ou empréstimo: unidade e tipo de controle não podem mudar.
        </p>
      ) : null}
      <Campo id="descricao" rotulo="Descrição (opcional)" erro={errors.descricao?.message}>
        <textarea
          id="descricao"
          rows={3}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("descricao")}
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Especificações (opcional, ex.: Tensão = 5 V)</legend>
        {especificacoes.fields.map((campo, i) => (
          <div key={campo.id} className="flex items-start gap-2">
            <div className="flex-1">
              <Input aria-label={`Nome da especificação ${i + 1}`} placeholder="Nome" {...register(`especificacoes.${i}.chave`)} />
              {errors.especificacoes?.[i]?.chave ? (
                <p className="mt-1 text-xs text-red-700">{errors.especificacoes[i]?.chave?.message}</p>
              ) : null}
            </div>
            <div className="flex-1">
              <Input aria-label={`Valor da especificação ${i + 1}`} placeholder="Valor" {...register(`especificacoes.${i}.valor`)} />
              {errors.especificacoes?.[i]?.valor ? (
                <p className="mt-1 text-xs text-red-700">{errors.especificacoes[i]?.valor?.message}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" aria-label={`Remover especificação ${i + 1}`} onClick={() => especificacoes.remove(i)}>
              Remover
            </Button>
          </div>
        ))}
        {errors.especificacoes?.root?.message || errors.especificacoes?.message ? (
          <p className="text-xs text-red-700">{errors.especificacoes?.root?.message ?? errors.especificacoes?.message}</p>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => especificacoes.append({ chave: "", valor: "" })}>
          Adicionar especificação
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Foto (opcional)</legend>
        {fotoAtual ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do Storage; next/image exigiria configurar o domínio
          <img src={fotoAtual} alt="Foto do item" className="h-40 w-40 rounded-md border object-cover" />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary">
            {processandoFoto ? "Preparando..." : fotoAtual ? "Trocar foto" : "Tirar ou escolher foto"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={processandoFoto}
              onChange={(e) => void aoEscolherFoto(e.target.files?.[0])}
            />
          </label>
          {fotoAtual ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFotoNova(null);
                setRemoverFoto(Boolean(item?.foto_url));
              }}
            >
              Remover foto
            </Button>
          ) : null}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("ativo")} />
        Item ativo (inativo some da lista padrão e não recebe entradas)
      </label>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || processandoFoto}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Janela para cadastrar (item = null) ou editar um item. */
export function DialogoItem({
  item,
  categorias,
  aoFechar,
  aoConcluir,
}: {
  item: ItemLista | null;
  categorias: Categoria[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  return (
    <Dialogo aberto titulo={item ? "Editar item" : "Novo item"} aoFechar={aoFechar}>
      <FormularioItem item={item} categorias={categorias} aoFechar={aoFechar} aoConcluir={aoConcluir} />
    </Dialogo>
  );
}
