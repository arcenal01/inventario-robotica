"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { ROTULO_PAPEL, ROTULO_STATUS, type PapelUsuario, type Perfil, type StatusCadastro } from "@/types";
import { esquemaAlteracaoPerfil, type AlteracaoPerfil } from "./schemas";

type Alteracao = { id: string; mudancas: AlteracaoPerfil };

const PAPEIS: PapelUsuario[] = ["aluno", "professor", "admin"];

const COR_STATUS: Record<StatusCadastro, "default" | "success" | "warning" | "danger"> = {
  pendente: "warning",
  aprovado: "success",
  rejeitado: "danger",
  bloqueado: "danger",
};

function SeletorPapel({
  valor,
  aoMudar,
  desabilitado,
  rotulo,
}: {
  valor: PapelUsuario;
  aoMudar: (novo: PapelUsuario) => void;
  desabilitado?: boolean;
  rotulo: string;
}) {
  return (
    <select
      aria-label={rotulo}
      value={valor}
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value as PapelUsuario)}
      className="h-9 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
    >
      {PAPEIS.map((p) => (
        <option key={p} value={p}>
          {ROTULO_PAPEL[p]}
        </option>
      ))}
    </select>
  );
}

function Pendente({
  usuario,
  eAdmin,
  ocupado,
  aoAlterar,
}: {
  usuario: Perfil;
  eAdmin: boolean;
  ocupado: boolean;
  aoAlterar: (mudancas: AlteracaoPerfil) => void;
}) {
  // Só o admin escolhe a função na aprovação (é assim que um professor é aprovado).
  const [funcao, setFuncao] = useState<PapelUsuario>("aluno");

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-4">
        <div>
          <p className="font-medium">{usuario.nome}</p>
          <p className="break-all text-sm text-muted-foreground">{usuario.email}</p>
          <p className="text-xs text-muted-foreground">Cadastrado em {new Date(usuario.criado_em).toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eAdmin ? <SeletorPapel valor={funcao} aoMudar={setFuncao} desabilitado={ocupado} rotulo="Função ao aprovar" /> : null}
          <Button
            size="sm"
            disabled={ocupado}
            onClick={() => aoAlterar({ status_cadastro: "aprovado", ...(eAdmin ? { perfil: funcao } : {}) })}
          >
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => aoAlterar({ status_cadastro: "rejeitado" })}
          >
            Rejeitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PainelUsuarios({ eu }: { eu: { id: string; perfil: PapelUsuario } }) {
  const supabase = useMemo(() => criarClienteNavegador(), []);
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const eAdmin = eu.perfil === "admin";

  const consulta = useQuery({
    queryKey: ["perfis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis").select("*").order("criado_em", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const alterar = useMutation({
    mutationFn: async ({ id, mudancas }: Alteracao) => {
      const validas = esquemaAlteracaoPerfil.parse(mudancas);
      const { data, error } = await supabase.from("perfis").update(validas).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      // O RLS não dá erro quando bloqueia: apenas não altera nenhuma linha.
      if (!data || data.length === 0) throw new Error("Sem permissão ou usuário não encontrado.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["perfis"] }),
  });

  const lista = consulta.data ?? [];
  const pendentes = lista.filter((u) => u.status_cadastro === "pendente");
  const termo = busca.trim().toLowerCase();
  const cadastrados = lista.filter(
    (u) =>
      u.status_cadastro !== "pendente" &&
      (termo === "" || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)),
  );

  // Professor só mexe em alunos; admin em todos (menos em si mesmo). O banco confere de novo.
  const podeGerenciar = (u: Perfil) => u.id !== eu.id && (eAdmin || u.perfil === "aluno");
  const ocupado = (id: string) => alterar.isPending && alterar.variables?.id === id;
  const pedir = (id: string, mudancas: AlteracaoPerfil) => alterar.mutate({ id, mudancas });

  if (consulta.isPending) return <p className="text-sm text-muted-foreground">Carregando usuários...</p>;

  if (consulta.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-md bg-red-50 p-4 text-sm text-red-800">
        <p>Não foi possível carregar os usuários: {consulta.error.message}</p>
        <Button size="sm" variant="outline" onClick={() => consulta.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alterar.isError ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {alterar.error.message}
        </p>
      ) : null}

      <section aria-labelledby="titulo-pendentes" className="space-y-3">
        <h2 id="titulo-pendentes" className="text-lg font-semibold">
          Aguardando aprovação ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cadastro pendente.</p>
        ) : (
          pendentes.map((u) => (
            <Pendente
              key={u.id}
              usuario={u}
              eAdmin={eAdmin}
              ocupado={ocupado(u.id)}
              aoAlterar={(mudancas) => pedir(u.id, mudancas)}
            />
          ))
        )}
      </section>

      <section aria-labelledby="titulo-cadastrados" className="space-y-3">
        <h2 id="titulo-cadastrados" className="text-lg font-semibold">
          Cadastrados
        </h2>
        <Input
          type="search"
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {cadastrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          cadastrados.map((u) => (
            <Card key={u.id}>
              <CardContent className="space-y-3 p-4 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {u.nome}
                      {u.id === eu.id ? <span className="text-muted-foreground"> (você)</span> : null}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge>{ROTULO_PAPEL[u.perfil]}</Badge>
                    <Badge variant={COR_STATUS[u.status_cadastro]}>{ROTULO_STATUS[u.status_cadastro]}</Badge>
                  </div>
                </div>

                {podeGerenciar(u) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {eAdmin ? (
                      <SeletorPapel
                        valor={u.perfil}
                        rotulo={`Função de ${u.nome}`}
                        desabilitado={ocupado(u.id)}
                        aoMudar={(novo) => {
                          if (novo === u.perfil) return;
                          if (novo === "admin" && !window.confirm(`Tornar ${u.nome} administrador?`)) return;
                          pedir(u.id, { perfil: novo });
                        }}
                      />
                    ) : null}
                    {u.status_cadastro === "aprovado" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado(u.id)}
                        onClick={() => {
                          if (window.confirm(`Bloquear o acesso de ${u.nome}?`)) pedir(u.id, { status_cadastro: "bloqueado" });
                        }}
                      >
                        Bloquear
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado(u.id)}
                        onClick={() => pedir(u.id, { status_cadastro: "aprovado" })}
                      >
                        Reativar
                      </Button>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
