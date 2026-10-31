"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PapelUsuario } from "@/types";
import { useCategorias, useItens, type ItemLista } from "./consultas";
import { DetalheItem } from "./detalhe-item";
import { DialogoItem } from "./dialogo-item";
import { FILTROS_INICIAIS, filtrarItens, formatarQuantidade, ordenarItens, type Filtros } from "./filtros";
import { urlFoto } from "./foto";

type Janela = { tipo: "detalhe"; item: ItemLista } | { tipo: "editar"; item: ItemLista | null } | null;

/** Lista de itens com busca e filtros. Professor/admin cadastram e editam; aluno só consulta. */
export function PainelItens({ papel }: { papel: PapelUsuario }) {
  const itensQ = useItens();
  const categoriasQ = useCategorias();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const podeEditar = papel === "admin" || papel === "professor";

  const visiveis = useMemo(() => ordenarItens(filtrarItens(itensQ.data ?? [], filtros)), [itensQ.data, filtros]);
  const abaixoMinimo = useMemo(() => (itensQ.data ?? []).filter((i) => i.abaixo_minimo).length, [itensQ.data]);

  function mudar<K extends keyof Filtros>(chave: K, valor: Filtros[K]) {
    setFiltros((f) => ({ ...f, [chave]: valor }));
  }

  if (itensQ.isPending || categoriasQ.isPending) return <p className="text-sm text-muted-foreground">Carregando itens...</p>;
  if (itensQ.isError || categoriasQ.isError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar os itens: {(itensQ.error ?? categoriasQ.error)?.message}
      </p>
    );
  }

  const categorias = categoriasQ.data ?? [];
  const filtrosAlterados = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIAIS);

  return (
    <div className="space-y-4">
      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setJanela({ tipo: "editar", item: null })}>
            Novo item
          </Button>
          <Link
            href="/itens/categorias"
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary"
          >
            Categorias
          </Link>
        </div>
      ) : null}

      {aviso ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      ) : null}

      {abaixoMinimo > 0 && !filtros.soAbaixoMinimo ? (
        <button
          type="button"
          onClick={() => setFiltros({ ...FILTROS_INICIAIS, soAbaixoMinimo: true })}
          className="w-full rounded-md bg-amber-50 p-3 text-left text-sm text-amber-900 hover:bg-amber-100"
        >
          {abaixoMinimo === 1 ? "1 item está" : `${abaixoMinimo} itens estão`} abaixo do estoque mínimo. Toque para ver.
        </button>
      ) : null}

      <div className="space-y-2">
        <Input
          type="search"
          placeholder="Buscar por código, nome ou descrição"
          aria-label="Buscar por código, nome ou descrição"
          value={filtros.busca}
          onChange={(e) => mudar("busca", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Select aria-label="Categoria" value={filtros.categoriaId} onChange={(e) => mudar("categoriaId", e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tipo de controle"
            value={filtros.tipoControle}
            onChange={(e) => mudar("tipoControle", e.target.value as Filtros["tipoControle"])}
          >
            <option value="">Consumíveis e emprestáveis</option>
            <option value="consumivel">Só consumíveis</option>
            <option value="emprestavel">Só emprestáveis</option>
          </Select>
          <Select aria-label="Situação" value={filtros.status} onChange={(e) => mudar("status", e.target.value as Filtros["status"])}>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="">Ativos e inativos</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filtros.soAbaixoMinimo} onChange={(e) => mudar("soAbaixoMinimo", e.target.checked)} />
            Só abaixo do mínimo
          </label>
          {filtrosAlterados ? (
            <Button variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {visiveis.length === 1 ? "1 item" : `${visiveis.length} itens`}
      </p>

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((item) => {
            const foto = urlFoto(item.foto_url);
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="p-0 sm:p-0">
                    <button
                      type="button"
                      onClick={() => setJanela({ tipo: "detalhe", item })}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      {foto ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto do Storage; next/image exigiria configurar o domínio
                        <img src={foto} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md border object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-secondary font-mono text-xs text-muted-foreground">
                          {item.codigo.split("-")[0]}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.nome}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {item.codigo} · {item.categoria_nome}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {item.tipo_controle === "emprestavel" ? <Badge>Emprestável</Badge> : null}
                          {item.status === "inativo" ? <Badge variant="warning">Inativo</Badge> : null}
                          {item.abaixo_minimo ? <Badge variant="danger">Abaixo do mínimo</Badge> : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-semibold">{formatarQuantidade(item.saldo_total)}</span>
                        <span className="block text-xs text-muted-foreground">{item.unidade}</span>
                      </span>
                    </button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {janela?.tipo === "detalhe" ? (
        <DetalheItem
          item={janela.item}
          podeEditar={podeEditar}
          aoEditar={() => setJanela({ tipo: "editar", item: janela.item })}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela?.tipo === "editar" ? (
        <DialogoItem
          item={janela.item}
          categorias={categorias}
          aoFechar={() => setJanela(null)}
          aoConcluir={(mensagem) => {
            setJanela(null);
            setAviso(mensagem);
          }}
        />
      ) : null}
    </div>
  );
}
