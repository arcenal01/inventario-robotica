"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { novaChave } from "@/lib/chave";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { usePosicoes } from "@/features/estoque/consultas";
import { useCategorias, useItens } from "./consultas";
import {
  agruparCategorias,
  agruparLocais,
  chaveCategoria,
  chaveLocal,
  lerPlanilha,
  planejarItens,
  validarCategorias,
  type DestinoCategoria,
  type GrupoCategoria,
} from "./importacao";
import { ROTULO_TIPO_CONTROLE, TIPOS_CONTROLE } from "./schemas";

type Resultado = { codigo: string; nome: string; ok: boolean; mensagem: string };

const MOTIVO_ENTRADA = "Importação da planilha de coleta";

/**
 * Importa a planilha do site de coleta: cria as categorias que faltam, cadastra os itens com o
 * MESMO código da coleta (para as etiquetas valerem) e, para os locais ligados a uma posição,
 * lança a quantidade como entrada de estoque. Itens cujo código já existe são pulados.
 */
export function ImportarPlanilha() {
  const queryClient = useQueryClient();
  const itensQ = useItens();
  const categoriasQ = useCategorias();
  const posicoesQ = usePosicoes();

  const [texto, setTexto] = useState("");
  const [destinos, setDestinos] = useState<Record<string, Pick<GrupoCategoria, "destino" | "tipoControle">>>({});
  const [locais, setLocais] = useState<Record<string, string>>({}); // chave do local -> id da posição ("" = não lançar)
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const categorias = useMemo(() => categoriasQ.data ?? [], [categoriasQ.data]);
  const leitura = useMemo(() => (texto.trim() ? lerPlanilha(texto) : null), [texto]);
  const codigosExistentes = useMemo(() => new Set((itensQ.data ?? []).map((i) => i.codigo.toUpperCase())), [itensQ.data]);
  const plano = useMemo(() => planejarItens(leitura?.linhas ?? [], codigosExistentes), [leitura, codigosExistentes]);
  const sugestoes = useMemo(() => agruparCategorias(leitura?.linhas ?? [], categorias), [leitura, categorias]);
  const grupos: GrupoCategoria[] = sugestoes.map((g) => ({ ...g, ...destinos[chaveCategoria(g.texto)] }));
  const gruposLocal = useMemo(() => agruparLocais(leitura?.linhas ?? []), [leitura]);
  const problemasCategoria = validarCategorias(grupos, categorias);

  const novos = plano.filter((i) => i.situacao === "novo");
  const jaExistem = plano.length - novos.length;
  const posicoes = posicoesQ.data ?? [];
  const posicaoPorLocal = (local: string) => posicoes.find((p) => p.id === locais[chaveLocal(local)]);
  const comEstoque = novos.filter((i) => i.quantidade > 0 && posicaoPorLocal(i.local)).length;

  function mudarGrupo(texto: string, mudanca: Partial<Pick<GrupoCategoria, "destino" | "tipoControle">>) {
    const chave = chaveCategoria(texto);
    const atual = grupos.find((g) => chaveCategoria(g.texto) === chave);
    if (!atual) return;
    setDestinos((d) => ({ ...d, [chave]: { destino: atual.destino, tipoControle: atual.tipoControle, ...mudanca } }));
  }

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setTexto(await arquivo.text());
    setResultados(null);
  }

  async function importar() {
    setErroGeral(null);
    setResultados(null);
    const supabase = criarClienteNavegador();

    // 1) Categorias novas (se alguma falhar, nada de itens é criado)
    const idPorCategoria = new Map<string, string>();
    for (const g of grupos) {
      const chave = chaveCategoria(g.texto);
      if (g.destino.tipo === "existente") {
        idPorCategoria.set(chave, g.destino.categoriaId);
        continue;
      }
      setProgresso(`Criando a categoria ${g.destino.nome}...`);
      const { data, error } = await supabase
        .from("categorias")
        .insert({ nome: g.destino.nome.trim(), prefixo: g.destino.prefixo })
        .select("id")
        .single();
      if (error) {
        setProgresso(null);
        setErroGeral(`Não foi possível criar a categoria ${g.destino.nome}: ${error.message}. Nenhum item foi importado.`);
        await queryClient.invalidateQueries({ queryKey: ["categorias"] });
        return;
      }
      idPorCategoria.set(chave, data.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["categorias"] });

    // 2) Itens (com o código da coleta) e 3) entrada de estoque na posição escolhida
    const lista: Resultado[] = [];
    for (const [n, item] of novos.entries()) {
      setProgresso(`Importando ${n + 1} de ${novos.length}: ${item.codigo}`);
      const grupo = grupos.find((g) => chaveCategoria(g.texto) === chaveCategoria(item.categoria));
      const { data, error } = await supabase
        .from("itens")
        .insert({
          codigo: item.codigo,
          nome: item.nome,
          categoria_id: idPorCategoria.get(chaveCategoria(item.categoria))!,
          unidade: "un",
          tipo_controle: grupo?.tipoControle ?? "consumivel",
          descricao: item.descricao,
        })
        .select("id")
        .single();
      if (error) {
        lista.push({ codigo: item.codigo, nome: item.nome, ok: false, mensagem: `Item não cadastrado: ${error.message}` });
        continue;
      }

      const posicao = posicaoPorLocal(item.local);
      if (!posicao || item.quantidade === 0) {
        lista.push({ codigo: item.codigo, nome: item.nome, ok: true, mensagem: posicao ? "Cadastrado (quantidade 0)." : "Cadastrado, sem estoque lançado." });
        continue;
      }
      const { error: erroEntrada } = await supabase.rpc("registrar_entrada", {
        p_item_id: data.id,
        p_endereco_id: posicao.id,
        p_quantidade: item.quantidade,
        p_chave_idempotencia: novaChave(),
        p_motivo: MOTIVO_ENTRADA,
      });
      lista.push(
        erroEntrada
          ? { codigo: item.codigo, nome: item.nome, ok: false, mensagem: `Cadastrado, mas a entrada de ${item.quantidade} falhou (${erroEntrada.message}). Lance pela ficha do item.` }
          : { codigo: item.codigo, nome: item.nome, ok: true, mensagem: `Cadastrado com ${item.quantidade} em ${posicao.codigo}.` },
      );
    }

    setProgresso(null);
    setResultados(lista);
    await Promise.all(
      [["itens"], ["saldos"], ["movimentacoes"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  if (itensQ.isPending || categoriasQ.isPending || posicoesQ.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }
  const erroCarga = itensQ.error ?? categoriasQ.error ?? posicoesQ.error;
  if (erroCarga && !(itensQ.data && categoriasQ.data && posicoesQ.data)) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar os dados: {erroCarga.message}
      </p>
    );
  }

  if (resultados) {
    const falhas = resultados.filter((r) => !r.ok);
    return (
      <div className="space-y-4">
        <p role="status" className={`rounded-md p-3 text-sm ${falhas.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          {resultados.length - falhas.length} de {resultados.length} item(ns) importado(s) sem problema.
          {falhas.length ? ` ${falhas.length} com problema (veja abaixo).` : ""}
        </p>
        <ul className="divide-y rounded-md border text-sm">
          {[...falhas, ...resultados.filter((r) => r.ok)].map((r) => (
            <li key={r.codigo} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
              <span className="font-mono font-semibold">{r.codigo}</span>
              <span className="min-w-0 flex-1">{r.nome}</span>
              <span className={r.ok ? "text-muted-foreground" : "text-red-800"}>{r.mensagem}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href="/itens" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            Ver itens
          </Link>
          <Link
            href={`/itens/etiquetas?codigos=${resultados.filter((r) => r.ok).map((r) => encodeURIComponent(r.codigo)).join(",")}`}
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary"
          >
            Etiquetas dos importados
          </Link>
          <Button variant="ghost" onClick={() => { setTexto(""); setResultados(null); setDestinos({}); setLocais({}); }}>
            Importar outra planilha
          </Button>
        </div>
      </div>
    );
  }

  const ocupado = progresso !== null;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Planilha</h2>
        <p className="text-sm text-muted-foreground">
          Na planilha do Google, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole abaixo, com a linha de cabeçalho. Ou escolha um
          arquivo .csv (Arquivo, Fazer download, CSV). Colunas usadas: Código, Nome, Quantidade, Local, Categoria e Observações.
        </p>
        <textarea
          aria-label="Conteúdo da planilha"
          rows={6}
          value={texto}
          disabled={ocupado}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Código\tNome\tQuantidade\tLocal\tCategoria\tObservações\nALI-001\tALICATE DE CORTE RENTE\t16\tARMARIO 4\tFerramentas\t"}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary">
          Escolher arquivo CSV
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" disabled={ocupado} onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])} />
        </label>
      </section>

      {leitura ? (
        <>
          <p className="text-sm">
            <strong>{plano.length}</strong> item(ns) lido(s): <strong>{novos.length}</strong> novo(s)
            {jaExistem ? `, ${jaExistem} já cadastrado(s) (serão pulados)` : ""}
            {leitura.erros.length ? `, ${leitura.erros.length} linha(s) com erro (não entram)` : ""}.
          </p>

          {leitura.erros.length > 0 ? (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-red-800">Linhas que não vão entrar</h3>
              <ul className="divide-y rounded-md border border-red-200 bg-red-50 text-sm text-red-900">
                {leitura.erros.map((e) => (
                  <li key={`${e.linha}-${e.codigo}`} className="px-3 py-2">
                    Linha {e.linha}
                    {e.codigo ? <span className="font-mono"> ({e.codigo})</span> : null}: {e.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {grupos.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">2. Categorias</h2>
              <p className="text-sm text-muted-foreground">
                Cada categoria da planilha vira uma categoria do sistema. O prefixo da categoria só vale para itens cadastrados
                depois: os importados mantêm o código da coleta.
              </p>
              <ul className="space-y-2">
                {grupos.map((g) => (
                  <li key={chaveCategoria(g.texto)}>
                    <Card>
                      <CardContent className="space-y-2 p-3 sm:p-3">
                        <p className="text-sm">
                          <strong>{g.texto || "(sem categoria)"}</strong>{" "}
                          <span className="text-muted-foreground">· {g.quantidadeItens} item(ns)</span>
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select
                            aria-label={`Destino da categoria ${g.texto}`}
                            disabled={ocupado}
                            value={g.destino.tipo === "existente" ? g.destino.categoriaId : "__nova"}
                            onChange={(e) => {
                              const valor = e.target.value;
                              const sugerido = sugestoes.find((s) => chaveCategoria(s.texto) === chaveCategoria(g.texto))?.destino;
                              const destino: DestinoCategoria =
                                valor !== "__nova"
                                  ? { tipo: "existente", categoriaId: valor }
                                  : sugerido?.tipo === "nova"
                                    ? sugerido
                                    : { tipo: "nova", nome: (g.texto || "Outros").slice(0, 40), prefixo: "" };
                              mudarGrupo(g.texto, { destino });
                            }}
                          >
                            <option value="__nova">Criar categoria nova</option>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>
                                Usar: {c.nome} ({c.prefixo})
                              </option>
                            ))}
                          </Select>
                          <Select
                            aria-label={`Tipo de controle da categoria ${g.texto}`}
                            disabled={ocupado}
                            value={g.tipoControle}
                            onChange={(e) => mudarGrupo(g.texto, { tipoControle: e.target.value as GrupoCategoria["tipoControle"] })}
                          >
                            {TIPOS_CONTROLE.map((t) => (
                              <option key={t} value={t}>
                                {ROTULO_TIPO_CONTROLE[t]}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {g.destino.tipo === "nova" ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                            <Input
                              aria-label={`Nome da categoria nova para ${g.texto}`}
                              disabled={ocupado}
                              value={g.destino.nome}
                              maxLength={40}
                              onChange={(e) => mudarGrupo(g.texto, { destino: { ...(g.destino as Extract<DestinoCategoria, { tipo: "nova" }>), nome: e.target.value } })}
                            />
                            <Input
                              aria-label={`Prefixo da categoria nova para ${g.texto}`}
                              disabled={ocupado}
                              value={g.destino.prefixo}
                              maxLength={5}
                              autoCapitalize="characters"
                              className="font-mono uppercase"
                              onChange={(e) =>
                                mudarGrupo(g.texto, {
                                  destino: { ...(g.destino as Extract<DestinoCategoria, { tipo: "nova" }>), prefixo: e.target.value.trim().toUpperCase() },
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
              {problemasCategoria.length > 0 ? (
                <ul role="alert" className="space-y-1 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {problemasCategoria.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {gruposLocal.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">3. Locais e estoque</h2>
              <p className="text-sm text-muted-foreground">
                Para lançar a quantidade no estoque, ligue cada local da coleta a uma posição (crie as posições antes, em
                Endereços). Local sem posição: o item é cadastrado sem estoque, e o local anotado fica na descrição.
              </p>
              {posicoes.length === 0 ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Ainda não há posições cadastradas. Os itens serão importados sem estoque; depois lance as entradas ou importe
                  de novo outra planilha só com os que faltam.
                </p>
              ) : null}
              <ul className="divide-y rounded-md border">
                {gruposLocal.map((l) => (
                  <li key={chaveLocal(l.texto)} className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_16rem]">
                    <span className="text-sm">
                      {l.texto || "(sem local)"} <span className="text-muted-foreground">· {l.quantidadeItens} item(ns)</span>
                    </span>
                    <Select
                      aria-label={`Posição para ${l.texto || "itens sem local"}`}
                      disabled={ocupado || posicoes.length === 0}
                      value={locais[chaveLocal(l.texto)] ?? ""}
                      onChange={(e) => setLocais((m) => ({ ...m, [chaveLocal(l.texto)]: e.target.value }))}
                    >
                      <option value="">Não lançar estoque</option>
                      {posicoes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo}
                          {p.nome ? ` · ${p.nome}` : ""}
                        </option>
                      ))}
                    </Select>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plano.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">4. Conferir e importar</h2>
              <ul className="max-h-96 divide-y overflow-y-auto rounded-md border text-sm">
                {plano.map((i) => {
                  const posicao = posicaoPorLocal(i.local);
                  return (
                    <li key={i.codigo} className="space-y-1 px-3 py-2">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono font-semibold">{i.codigo}</span>
                        <span className="min-w-0 flex-1">{i.nome}</span>
                        {i.situacao === "ja_existe" ? <Badge variant="warning">Já cadastrado</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {i.quantidade} un · {i.categoria || "(sem categoria)"} ·{" "}
                        {posicao ? `entrada em ${posicao.codigo}` : `sem estoque (local: ${i.local || "não informado"})`}
                      </p>
                      {i.avisoContagem ? <p className="text-xs text-amber-800">{i.avisoContagem}</p> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-muted-foreground">
                Serão cadastrados {novos.length} item(ns) com o código da coleta, {comEstoque} com entrada de estoque.
              </p>
              {progresso ? (
                <p role="status" className="rounded-md bg-secondary p-3 text-sm">
                  {progresso} Não feche esta página.
                </p>
              ) : null}
              {erroGeral ? (
                <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {erroGeral}
                </p>
              ) : null}
              <Button onClick={() => void importar()} disabled={ocupado || novos.length === 0 || problemasCategoria.length > 0}>
                {ocupado ? "Importando..." : `Importar ${novos.length} item(ns)`}
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
