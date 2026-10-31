"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SeletorOrigem, SeletorPosicao } from "@/features/estoque/campos-endereco";
import { usePessoasAprovadas, usePosicoes } from "@/features/estoque/consultas";
import type { ItemLista } from "@/features/itens/consultas";
import { formatarQuantidade, normalizar } from "@/features/itens/filtros";
import { SeletorItem } from "@/features/itens/seletor-item";
import { novaChave } from "@/lib/chave";
import { hojeBrasilia } from "@/lib/datas";
import { traduzirErroBanco } from "@/lib/erros";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { ROTULO_PAPEL } from "@/types";
import type { Emprestimo } from "./consultas";

function lerNumero(texto: string): number {
  return texto.trim() === "" ? NaN : Number(texto.replace(",", "."));
}

function validarQuantidade(valor: number, maximo: number, unidade: string): string | null {
  if (!Number.isFinite(valor) || valor <= 0) return "Informe uma quantidade maior que zero";
  if (unidade === "un" && !Number.isInteger(valor)) return 'Em "un" use número inteiro';
  if (valor > maximo) return `Máximo ${formatarQuantidade(maximo)} ${unidade}`;
  return null;
}

async function atualizarTelas(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all(
    ["emprestimos", "itens", "saldos", "movimentacoes"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
  );
}

function Rodape({ enviando, rotulo, aoFechar, aoEnviar, erro }: {
  enviando: boolean; rotulo: string; aoFechar: () => void; aoEnviar: () => void; erro: string | null;
}) {
  return (
    <>
      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button onClick={aoEnviar} disabled={enviando}>
          {enviando ? "Registrando..." : rotulo}
        </Button>
      </div>
    </>
  );
}

/** Professor/admin emprestam um item emprestável de uma posição para uma pessoa aprovada. */
export function DialogoNovoEmprestimo({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: (m: string) => void }) {
  const queryClient = useQueryClient();
  const pessoasQ = usePessoasAprovadas();
  const [chave] = useState(novaChave);
  const [item, setItem] = useState<ItemLista | null>(null);
  const [origem, setOrigem] = useState("");
  const [saldoOrigem, setSaldoOrigem] = useState(0);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const hoje = hojeBrasilia();

  const pessoas = useMemo(() => {
    const termo = normalizar(buscaPessoa);
    return (pessoasQ.data ?? []).filter((p) => !termo || normalizar(`${p.nome} ${p.turma ?? ""}`).includes(termo));
  }, [pessoasQ.data, buscaPessoa]);

  async function enviar() {
    setErro(null);
    const n = lerNumero(quantidade);
    const novos: Record<string, string> = {};
    if (!item) novos.item = "Escolha o item";
    if (item && !origem) novos.origem = "Escolha de onde sai";
    if (!pessoa) novos.pessoa = "Escolha quem leva";
    const problema = item && origem ? validarQuantidade(n, saldoOrigem, item.unidade) : null;
    if (problema) novos.quantidade = problema;
    if (prazo && prazo < hoje) novos.prazo = "O prazo não pode estar no passado";
    setErros(novos);
    if (Object.keys(novos).length > 0 || !item) return;

    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("emprestar", {
      p_item_id: item.id,
      p_endereco_id: origem,
      p_emprestado_para: pessoa,
      p_quantidade: n,
      p_chave_idempotencia: chave,
      p_prazo_previsto: prazo || undefined,
      p_observacao: observacao.trim() || undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizarTelas(queryClient);
    const nome = pessoasQ.data?.find((p) => p.id === pessoa)?.nome ?? "";
    aoConcluir(`${formatarQuantidade(n)} ${item.unidade} de ${item.codigo} emprestado(s) para ${nome}.`);
  }

  return (
    <Dialogo aberto titulo="Novo empréstimo" aoFechar={aoFechar}>
      <div className="space-y-4">
        <Campo id="item" rotulo="Item (só emprestáveis)" erro={erros.item}>
          <SeletorItem
            id="item"
            valor={item}
            aceitar={(i) => i.tipo_controle === "emprestavel"}
            aoMudar={(i) => {
              setItem(i);
              setOrigem("");
            }}
          />
        </Campo>
        {item ? (
          <Campo id="origem" rotulo="De onde sai" erro={erros.origem}>
            <SeletorOrigem
              id="origem"
              itemId={item.id}
              unidade={item.unidade}
              valor={origem}
              aoMudar={(id, saldo) => {
                setOrigem(id);
                setSaldoOrigem(saldo);
              }}
            />
          </Campo>
        ) : null}
        <Campo id="pessoa" rotulo="Quem leva" erro={erros.pessoa}>
          <div className="space-y-2">
            <Input
              type="search"
              aria-label="Buscar pessoa"
              placeholder="Buscar por nome ou turma"
              value={buscaPessoa}
              onChange={(e) => setBuscaPessoa(e.target.value)}
            />
            <Select id="pessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
              <option value="">{pessoasQ.isPending ? "Carregando..." : `Escolha (${pessoas.length})`}</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.turma ? ` · ${p.turma}` : ""}
                  {p.perfil !== "aluno" ? ` (${ROTULO_PAPEL[p.perfil]})` : ""}
                </option>
              ))}
            </Select>
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo id="quantidade" rotulo={`Quantidade${item ? ` (${item.unidade})` : ""}`} erro={erros.quantidade}>
            <Input id="quantidade" type="number" inputMode="decimal" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </Campo>
          <Campo id="prazo" rotulo="Devolver até (opcional)" erro={erros.prazo}>
            <Input id="prazo" type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Campo>
        </div>
        <Campo id="observacao" rotulo="Observação (opcional)">
          <Input id="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Campo>
        <Rodape enviando={enviando} rotulo="Emprestar" aoFechar={aoFechar} aoEnviar={() => void enviar()} erro={erro} />
      </div>
    </Dialogo>
  );
}

/** Devolução (pode ser parcial). O material volta para a posição escolhida (padrão: de onde saiu). */
export function DialogoDevolucao({ emprestimo, aoFechar, aoConcluir }: {
  emprestimo: Emprestimo; aoFechar: () => void; aoConcluir: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [chave] = useState(novaChave);
  const [quantidade, setQuantidade] = useState(String(emprestimo.pendente));
  const posicoesQ = usePosicoes();
  const [escolhido, setDestino] = useState(emprestimo.origem.id);
  // Se a posição de origem foi desativada (ex.: troca de QR), não serve de padrão
  const destino = posicoesQ.data?.some((p) => p.id === escolhido) ? escolhido : "";
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const u = emprestimo.item.unidade;

  async function enviar() {
    setErro(null);
    const n = lerNumero(quantidade);
    const novos: Record<string, string> = {};
    const problema = validarQuantidade(n, emprestimo.pendente, u);
    if (problema) novos.quantidade = problema;
    if (!destino) novos.destino = "Escolha onde guardar";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("devolver", {
      p_emprestimo_id: emprestimo.id,
      p_quantidade: n,
      p_endereco_destino_id: destino,
      p_chave_idempotencia: chave,
      p_motivo: motivo.trim() || undefined,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizarTelas(queryClient);
    aoConcluir(`Devolução de ${formatarQuantidade(n)} ${u} de ${emprestimo.item.codigo} registrada.`);
  }

  return (
    <Dialogo aberto titulo="Registrar devolução" aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm">
          <span className="font-medium">{emprestimo.item.nome}</span> com {emprestimo.pessoa?.nome ?? "?"}: faltam{" "}
          {formatarQuantidade(emprestimo.pendente)} {u}.
        </p>
        <Campo id="quantidade" rotulo={`Quantidade devolvida (${u})`} erro={erros.quantidade}>
          <Input id="quantidade" type="number" inputMode="decimal" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </Campo>
        <Campo id="destino" rotulo="Guardar em" erro={erros.destino}>
          <SeletorPosicao id="destino" itemId={emprestimo.item.id} unidade={u} valor={destino} aoMudar={setDestino} />
        </Campo>
        <Campo id="motivo" rotulo="Observação (opcional)">
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <Rodape enviando={enviando} rotulo="Devolver" aoFechar={aoFechar} aoEnviar={() => void enviar()} erro={erro} />
      </div>
    </Dialogo>
  );
}

/** Marca como perdido (tudo ou parte do que falta). Não mexe no saldo: o material já tinha saído. */
export function DialogoPerda({ emprestimo, aoFechar, aoConcluir }: {
  emprestimo: Emprestimo; aoFechar: () => void; aoConcluir: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [chave] = useState(novaChave);
  const [quantidade, setQuantidade] = useState(String(emprestimo.pendente));
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const u = emprestimo.item.unidade;

  async function enviar() {
    setErro(null);
    const n = lerNumero(quantidade);
    const novos: Record<string, string> = {};
    const problema = validarQuantidade(n, emprestimo.pendente, u);
    if (problema) novos.quantidade = problema;
    if (motivo.trim().length < 3) novos.motivo = "Explique o que aconteceu";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("marcar_emprestimo_perdido", {
      p_emprestimo_id: emprestimo.id,
      p_quantidade: n,
      p_motivo: motivo.trim(),
      p_chave_idempotencia: chave,
    });
    setEnviando(false);
    if (error) return setErro(traduzirErroBanco(error.message));
    await atualizarTelas(queryClient);
    aoConcluir(`${formatarQuantidade(n)} ${u} de ${emprestimo.item.codigo} marcado(s) como perdido(s).`);
  }

  return (
    <Dialogo aberto titulo="Marcar como perdido" aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm">
          <span className="font-medium">{emprestimo.item.nome}</span> com {emprestimo.pessoa?.nome ?? "?"}: faltam{" "}
          {formatarQuantidade(emprestimo.pendente)} {u}. Use quando o material não vai voltar (perdido ou quebrado fora da sala).
        </p>
        <Campo id="quantidade" rotulo={`Quantidade perdida (${u})`} erro={erros.quantidade}>
          <Input id="quantidade" type="number" inputMode="decimal" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </Campo>
        <Campo id="motivo" rotulo="O que aconteceu (obrigatório)" erro={erros.motivo}>
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <Rodape enviando={enviando} rotulo="Marcar perdido" aoFechar={aoFechar} aoEnviar={() => void enviar()} erro={erro} />
      </div>
    </Dialogo>
  );
}
