"use client";

import { useMemo, useState } from "react";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROTULO_MOVIMENTACAO, type TipoMovimentacao } from "@/features/estoque/consultas";
import { formatarData, formatarDataHora, hojeBrasilia } from "@/lib/datas";
import type { Coluna } from "./csv";
import {
  LIMITE_RELATORIO,
  useContagensParaRelatorio,
  useRelatorioDivergencias,
  useRelatorioEmprestimos,
  useRelatorioEstoque,
  useRelatorioMovimentacoes,
  type LinhaDivergencia,
  type LinhaEmprestimo,
  type LinhaEstoque,
  type LinhaMovimentacao,
} from "./consultas";
import {
  INFO_RELATORIO,
  contemTudo,
  diasAntes,
  filtrarEmprestimosRelatorio,
  intervaloBrasilia,
  situacaoRelatorio,
  somar,
  type SituacaoFiltro,
  type TipoRelatorio,
} from "./regras";
import { TabelaRelatorio } from "./tabela-relatorio";

function CampoBusca({ valor, aoMudar, dica }: { valor: string; aoMudar: (v: string) => void; dica: string }) {
  return (
    <Campo id="busca" rotulo="Buscar">
      <Input id="busca" type="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={dica} />
    </Campo>
  );
}

const COLUNAS_ESTOQUE: Coluna<LinhaEstoque>[] = [
  { titulo: "Endereço", valor: (l) => l.endereco.codigo + (l.endereco.ativo ? "" : " (inativo)") },
  { titulo: "Código", valor: (l) => l.item.codigo },
  { titulo: "Item", valor: (l) => l.item.nome },
  { titulo: "Categoria", valor: (l) => l.item.categoria?.nome ?? "" },
  { titulo: "Tipo", valor: (l) => (l.item.tipo_controle === "emprestavel" ? "Emprestável" : "Consumível") },
  { titulo: "Quantidade", valor: (l) => l.quantidade, numero: true },
  { titulo: "Unidade", valor: (l) => l.item.unidade },
];

function RelatorioEstoque() {
  const q = useRelatorioEstoque();
  const [busca, setBusca] = useState("");
  const linhas = useMemo(
    () => (q.data ?? []).filter((l) => contemTudo(`${l.endereco.codigo} ${l.endereco.nome ?? ""} ${l.item.codigo} ${l.item.nome}`, busca)),
    [q.data, busca],
  );
  const posicoes = new Set(linhas.map((l) => l.endereco.codigo)).size;
  return (
    <TabelaRelatorio
      titulo={INFO_RELATORIO.estoque.titulo}
      resumoFiltros={busca.trim() ? `Busca: "${busca.trim()}"` : "Todas as posições com saldo"}
      filtros={<CampoBusca valor={busca} aoMudar={setBusca} dica="Endereço (ex.: ARM01) ou item" />}
      colunas={COLUNAS_ESTOQUE}
      linhas={linhas}
      chave={(l) => `${l.endereco.codigo}|${l.item.codigo}`}
      carregando={q.isPending}
      erro={q.error?.message}
      limiteAtingido={(q.data?.length ?? 0) >= LIMITE_RELATORIO}
      rodape={
        <p className="text-muted-foreground">
          {posicoes} posição(ões) · {new Set(linhas.map((l) => l.item.codigo)).size} item(ns) diferentes
        </p>
      }
    />
  );
}

const COLUNAS_MOV: Coluna<LinhaMovimentacao>[] = [
  { titulo: "Data", valor: (m) => formatarDataHora(m.criado_em) },
  { titulo: "Tipo", valor: (m) => ROTULO_MOVIMENTACAO[m.tipo] },
  { titulo: "Código", valor: (m) => m.item.codigo },
  { titulo: "Item", valor: (m) => m.item.nome },
  { titulo: "Quantidade", valor: (m) => m.quantidade, numero: true },
  { titulo: "Unidade", valor: (m) => m.item.unidade },
  { titulo: "De", valor: (m) => m.origem?.codigo ?? "" },
  { titulo: "Para", valor: (m) => m.destino?.codigo ?? "" },
  { titulo: "Quem", valor: (m) => m.usuario?.nome ?? "" },
  { titulo: "Motivo", valor: (m) => m.motivo ?? "" },
];

function RelatorioMovimentacoes() {
  const hoje = hojeBrasilia();
  const [de, setDe] = useState(diasAntes(hoje, 30));
  const [ate, setAte] = useState(hoje);
  const [tipo, setTipo] = useState<TipoMovimentacao | "">("");
  const intervalo = intervaloBrasilia(de, ate);
  const q = useRelatorioMovimentacoes(intervalo?.inicio ?? "", intervalo?.fim ?? "", tipo);
  return (
    <TabelaRelatorio
      titulo={INFO_RELATORIO.movimentacoes.titulo}
      resumoFiltros={`De ${formatarData(de)} até ${formatarData(ate)}${tipo ? ` · ${ROTULO_MOVIMENTACAO[tipo]}` : ""}`}
      filtros={
        <>
          <Campo id="de" rotulo="De">
            <Input id="de" type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo id="ate" rotulo="Até">
            <Input id="ate" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Campo>
          <Campo id="tipo" rotulo="Tipo">
            <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacao | "")}>
              <option value="">Todos</option>
              {(Object.keys(ROTULO_MOVIMENTACAO) as TipoMovimentacao[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_MOVIMENTACAO[t]}
                </option>
              ))}
            </Select>
          </Campo>
        </>
      }
      colunas={COLUNAS_MOV}
      linhas={intervalo ? (q.data ?? []) : []}
      chave={(m) => m.id}
      carregando={Boolean(intervalo) && q.isPending}
      erro={intervalo ? q.error?.message : "Período inválido: a data inicial precisa ser antes da final."}
      limiteAtingido={(q.data?.length ?? 0) >= LIMITE_RELATORIO}
    />
  );
}

function RelatorioEmprestimos() {
  const hoje = hojeBrasilia();
  const q = useRelatorioEmprestimos();
  const [situacao, setSituacao] = useState<SituacaoFiltro>("abertos");
  const [busca, setBusca] = useState("");
  const linhas = useMemo(
    () =>
      filtrarEmprestimosRelatorio(q.data ?? [], situacao, hoje).filter((e) =>
        contemTudo(`${e.pessoa?.nome ?? ""} ${e.pessoa?.turma ?? ""} ${e.item.codigo} ${e.item.nome}`, busca),
      ),
    [q.data, situacao, busca, hoje],
  );
  const colunas: Coluna<LinhaEmprestimo>[] = [
    { titulo: "Emprestado em", valor: (e) => formatarData(e.emprestado_em) },
    { titulo: "Pessoa", valor: (e) => e.pessoa?.nome ?? "" },
    { titulo: "Turma", valor: (e) => e.pessoa?.turma ?? "" },
    { titulo: "Código", valor: (e) => e.item.codigo },
    { titulo: "Item", valor: (e) => e.item.nome },
    { titulo: "Emprestado", valor: (e) => e.quantidade, numero: true },
    { titulo: "Devolvido", valor: (e) => e.quantidade_devolvida, numero: true },
    { titulo: "Perdido", valor: (e) => e.quantidade_perdida, numero: true },
    { titulo: "Pendente", valor: (e) => e.pendente, numero: true },
    { titulo: "Prazo", valor: (e) => (e.prazo_previsto ? formatarData(e.prazo_previsto) : "Sem prazo") },
    { titulo: "Situação", valor: (e) => situacaoRelatorio(e, hoje) },
  ];
  const ROTULO: Record<SituacaoFiltro, string> = { abertos: "Em aberto", atrasados: "Atrasados", perdidos: "Com perda", todos: "Todos" };
  return (
    <TabelaRelatorio
      titulo={INFO_RELATORIO.emprestimos.titulo}
      resumoFiltros={`${ROTULO[situacao]}${busca.trim() ? ` · busca "${busca.trim()}"` : ""}`}
      filtros={
        <>
          <Campo id="situacao" rotulo="Situação">
            <Select id="situacao" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoFiltro)}>
              {(Object.keys(ROTULO) as SituacaoFiltro[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO[s]}
                </option>
              ))}
            </Select>
          </Campo>
          <CampoBusca valor={busca} aoMudar={setBusca} dica="Pessoa, turma ou item" />
        </>
      }
      colunas={colunas}
      linhas={linhas}
      chave={(e) => e.id}
      carregando={q.isPending}
      erro={q.error?.message}
      limiteAtingido={(q.data?.length ?? 0) >= LIMITE_RELATORIO}
      rodape={<p className="text-muted-foreground">Pendente no total: {somar(linhas, (e) => e.pendente).toLocaleString("pt-BR")} unidade(s)</p>}
    />
  );
}

const COLUNAS_DIV: Coluna<LinhaDivergencia>[] = [
  { titulo: "Endereço", valor: (d) => d.endereco_codigo },
  { titulo: "Código", valor: (d) => d.item_codigo },
  { titulo: "Item", valor: (d) => d.item_nome },
  { titulo: "Sistema", valor: (d) => d.quantidade_sistema, numero: true },
  { titulo: "Contado", valor: (d) => d.quantidade_contada, numero: true },
  { titulo: "Diferença", valor: (d) => d.divergencia, numero: true },
  { titulo: "Emprestado", valor: (d) => d.emprestado_em_aberto, numero: true },
  { titulo: "Observação", valor: (d) => [d.nao_listado ? "Não listado" : "", d.rodada > 1 ? `${d.rodada}ª contagem` : ""].filter(Boolean).join(" · ") },
  { titulo: "Ajuste", valor: (d) => (d.ajustado ? "Gerado" : "Pendente") },
];

function RelatorioDivergencias() {
  const contagensQ = useContagensParaRelatorio();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const contagemId = escolhida ?? contagensQ.data?.[0]?.id ?? null;
  const contagem = contagensQ.data?.find((c) => c.id === contagemId);
  const q = useRelatorioDivergencias(contagemId);
  const linhas = q.data ?? [];
  return (
    <TabelaRelatorio
      titulo={INFO_RELATORIO.divergencias.titulo}
      resumoFiltros={contagem ? `Contagem ${contagem.codigo} (aberta em ${formatarData(contagem.criado_em)})` : "Nenhuma contagem"}
      filtros={
        <Campo id="contagem" rotulo="Contagem">
          <Select id="contagem" value={contagemId ?? ""} onChange={(e) => setEscolhida(e.target.value)}>
            {(contagensQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {formatarData(c.criado_em)}
              </option>
            ))}
          </Select>
        </Campo>
      }
      colunas={COLUNAS_DIV}
      linhas={linhas}
      chave={(d) => d.id}
      carregando={contagensQ.isPending || (contagemId !== null && q.isPending)}
      erro={contagensQ.error?.message ?? q.error?.message}
      vazio={contagensQ.data?.length === 0 ? "Ainda não há contagens." : "Nenhuma divergência nesta contagem."}
      rodape={
        <p className="text-muted-foreground">
          Faltando: {somar(linhas.filter((d) => d.divergencia < 0), (d) => -d.divergencia).toLocaleString("pt-BR")} · Sobrando:{" "}
          {somar(linhas.filter((d) => d.divergencia > 0), (d) => d.divergencia).toLocaleString("pt-BR")}
        </p>
      }
    />
  );
}

export function Relatorio({ tipo }: { tipo: TipoRelatorio }) {
  if (tipo === "estoque") return <RelatorioEstoque />;
  if (tipo === "movimentacoes") return <RelatorioMovimentacoes />;
  if (tipo === "emprestimos") return <RelatorioEmprestimos />;
  return <RelatorioDivergencias />;
}
