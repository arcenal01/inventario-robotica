"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent } from "@/components/ui/card";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { useCategorias, useItens, type Categoria } from "./consultas";
import { esquemaCategoria, type DadosCategoria } from "./schemas";

function FormularioCategoria({
  categoria,
  aoFechar,
  aoConcluir,
}: {
  categoria: Categoria | null;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DadosCategoria>({
    resolver: zodResolver(esquemaCategoria),
    defaultValues: { nome: categoria?.nome ?? "", prefixo: categoria?.prefixo ?? "" },
  });
  const prefixoMudou = categoria && watch("prefixo").trim().toUpperCase() !== categoria.prefixo;

  async function aoEnviar(dados: DadosCategoria) {
    setErro(null);
    const supabase = criarClienteNavegador();
    const { data, error } = categoria
      ? await supabase.from("categorias").update(dados).eq("id", categoria.id).select("id")
      : await supabase.from("categorias").insert(dados).select("id");
    if (error) {
      setErro(
        error.message.includes("duplicate key")
          ? "Já existe uma categoria com este nome ou este prefixo."
          : error.message.includes("row-level security")
            ? "Sem permissão para salvar categorias."
            : error.message,
      );
      return;
    }
    if (!data || data.length === 0) {
      setErro("Sem permissão ou categoria não encontrada.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["categorias"] });
    await queryClient.invalidateQueries({ queryKey: ["itens"] });
    aoConcluir(categoria ? `Categoria ${dados.nome} atualizada.` : `Categoria ${dados.nome} criada.`);
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <Campo id="nome" rotulo="Nome (ex.: Sensores, Motores)" erro={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Campo>
      <Campo id="prefixo" rotulo="Prefixo do código (ex.: SEN gera SEN-001)" erro={errors.prefixo?.message}>
        <Input id="prefixo" autoCapitalize="characters" maxLength={5} {...register("prefixo")} />
      </Campo>
      {prefixoMudou ? (
        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          Os itens já cadastrados mantêm o código antigo (códigos são definitivos). Só os itens novos usam o prefixo novo.
        </p>
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
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Professor/admin criam e editam categorias e prefixos; categoria inativa não aparece no cadastro de itens. */
export function PainelCategorias() {
  const queryClient = useQueryClient();
  const categoriasQ = useCategorias();
  const itensQ = useItens();
  const [dialogo, setDialogo] = useState<{ categoria: Categoria | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternarAtiva(categoria: Categoria) {
    setErro(null);
    const { error } = await criarClienteNavegador().from("categorias").update({ ativa: !categoria.ativa }).eq("id", categoria.id);
    if (error) {
      setErro(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["categorias"] });
  }

  if (categoriasQ.isPending) return <p className="text-sm text-muted-foreground">Carregando categorias...</p>;
  if (categoriasQ.isError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar as categorias: {categoriasQ.error.message}
      </p>
    );
  }

  const quantidade = new Map<string, number>();
  for (const i of itensQ.data ?? []) quantidade.set(i.categoria_id, (quantidade.get(i.categoria_id) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O prefixo forma o código dos itens: cada prefixo tem a própria contagem (SEN-001, SEN-002, MOT-001...).
      </p>
      <Button size="sm" onClick={() => setDialogo({ categoria: null })}>
        Nova categoria
      </Button>

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <ul className="space-y-2">
        {(categoriasQ.data ?? []).map((c) => (
          <li key={c.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-4">
                <div className="space-y-1">
                  <p className="font-medium">
                    {c.nome} <span className="font-mono text-sm text-muted-foreground">{c.prefixo}</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{quantidade.get(c.id) === 1 ? "1 item" : `${quantidade.get(c.id) ?? 0} itens`}</Badge>
                    {!c.ativa ? <Badge variant="warning">Inativa</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDialogo({ categoria: c })}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void alternarAtiva(c)}>
                    {c.ativa ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {dialogo ? (
        <Dialogo aberto titulo={dialogo.categoria ? "Editar categoria" : "Nova categoria"} aoFechar={() => setDialogo(null)}>
          <FormularioCategoria
            categoria={dialogo.categoria}
            aoFechar={() => setDialogo(null)}
            aoConcluir={(mensagem) => {
              setDialogo(null);
              setAviso(mensagem);
            }}
          />
        </Dialogo>
      ) : null}
    </div>
  );
}
