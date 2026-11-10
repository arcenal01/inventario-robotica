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
import type { TipoEndereco } from "./arvore";
import { useTiposEndereco } from "./consultas";
import { esquemaTipoEndereco, type DadosTipoEndereco } from "./schemas";

function FormularioTipo({
  tipo,
  aoFechar,
  aoConcluir,
}: {
  tipo: TipoEndereco | null;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosTipoEndereco>({
    resolver: zodResolver(esquemaTipoEndereco),
    defaultValues: {
      nome: tipo?.nome ?? "",
      prefixo: tipo?.prefixo ?? "",
      nivel: tipo?.nivel ?? 1,
      armazena_itens: tipo?.armazena_itens ?? false,
    },
  });

  async function aoEnviar(dados: DadosTipoEndereco) {
    setErro(null);
    const supabase = criarClienteNavegador();
    if (tipo) {
      const { data, error } = await supabase.from("tipos_endereco").update(dados).eq("id", tipo.id).select("id");
      if (error) {
        setErro(error.message);
        return;
      }
      if (!data || data.length === 0) {
        setErro("Sem permissão ou tipo não encontrado.");
        return;
      }
    } else {
      const { error } = await supabase.from("tipos_endereco").insert(dados);
      if (error) {
        setErro(
          error.message.includes("duplicate key")
            ? "Já existe um tipo com este nome ou este prefixo."
            : error.message,
        );
        return;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["tipos_endereco"] });
    aoConcluir(tipo ? `Tipo ${dados.nome} atualizado.` : `Tipo ${dados.nome} criado.`);
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <Campo id="nome" rotulo="Nome (ex.: Armário, Estante, Gaveta, Caixa)" erro={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Campo>
      <Campo id="prefixo" rotulo="Prefixo do código (ex.: ARM)" erro={errors.prefixo?.message}>
        <Input id="prefixo" autoCapitalize="characters" maxLength={5} {...register("prefixo")} />
      </Campo>
      <Campo id="nivel" rotulo="Nível (1 = de fora; números maiores ficam dentro dos menores)" erro={errors.nivel?.message}>
        <Input id="nivel" type="number" inputMode="numeric" min={1} max={9} {...register("nivel", { valueAsNumber: true })} />
      </Campo>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" {...register("armazena_itens")} />
        <span>
          É uma posição (guarda itens). Só o nível mais interno deve ser posição; endereços de outros níveis só organizam.
        </span>
      </label>
      {tipo ? (
        <p className="text-xs text-muted-foreground">
          Se já existem endereços deste tipo, o banco não deixa mudar prefixo, nível nem se é posição. Crie outro tipo.
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

/** Tela do administrador: cria e edita os tipos de endereço (Armário, Estante, Gaveta, Caixa, Posição...). */
export function PainelTipos() {
  const queryClient = useQueryClient();
  const tiposQ = useTiposEndereco();
  const [dialogo, setDialogo] = useState<{ tipo: TipoEndereco | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternarAtivo(tipo: TipoEndereco) {
    setErro(null);
    const { error } = await criarClienteNavegador().from("tipos_endereco").update({ ativo: !tipo.ativo }).eq("id", tipo.id);
    if (error) {
      setErro(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["tipos_endereco"] });
  }

  if (tiposQ.isPending) return <p className="text-sm text-muted-foreground">Carregando tipos...</p>;
  if (tiposQ.isError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar os tipos: {tiposQ.error.message}
      </p>
    );
  }

  const tipos = tiposQ.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Os tipos definem os níveis dos endereços, por exemplo: Armário (1) &gt; Gaveta (2) &gt; Caixa (3) &gt; Posição (4). O
        código do endereço junta os prefixos, como ARM01-GAV03-CX02-P05.
      </p>
      <Button size="sm" onClick={() => setDialogo({ tipo: null })}>
        Novo tipo
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
        {tipos.map((t) => (
          <li key={t.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-4">
                <div className="space-y-1">
                  <p className="font-medium">
                    {t.nome} <span className="font-mono text-sm text-muted-foreground">{t.prefixo}</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge>Nível {t.nivel}</Badge>
                    {t.armazena_itens ? <Badge variant="success">Posição (guarda itens)</Badge> : null}
                    {!t.ativo ? <Badge variant="warning">Inativo</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: t })}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void alternarAtivo(t)}>
                    {t.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {dialogo ? (
        <Dialogo aberto titulo={dialogo.tipo ? "Editar tipo de endereço" : "Novo tipo de endereço"} aoFechar={() => setDialogo(null)}>
          <FormularioTipo
            tipo={dialogo.tipo}
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
