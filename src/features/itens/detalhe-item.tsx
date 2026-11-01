"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { useSaldosDoItem, type ItemLista } from "./consultas";
import { formatarQuantidade } from "./filtros";
import { urlFoto } from "./foto";
import { ROTULO_TIPO_CONTROLE, jsonParaEspecificacoes } from "./schemas";

/** Ficha do item: foto, dados, especificações e em quais endereços ele está guardado. */
export function DetalheItem({
  item,
  podeEditar,
  aoEditar,
  aoEntrada,
  aoFechar,
}: {
  item: ItemLista;
  podeEditar: boolean;
  aoEditar: () => void;
  aoEntrada: () => void;
  aoFechar: () => void;
}) {
  const saldosQ = useSaldosDoItem(item.id);
  const foto = urlFoto(item.foto_url);
  const especificacoes = jsonParaEspecificacoes(item.especificacoes);

  return (
    <Dialogo aberto titulo={item.nome} aoFechar={aoFechar}>
      <div className="space-y-4">
        <div className="flex gap-3">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do Storage; next/image exigiria configurar o domínio
            <img src={foto} alt={`Foto de ${item.nome}`} className="h-28 w-28 shrink-0 rounded-md border object-cover" />
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-sm font-semibold">{item.codigo}</p>
            <p className="text-sm text-muted-foreground">{item.categoria_nome}</p>
            <div className="flex flex-wrap gap-1">
              <Badge>{ROTULO_TIPO_CONTROLE[item.tipo_controle].split(" (")[0]}</Badge>
              {item.status === "inativo" ? <Badge variant="warning">Inativo</Badge> : null}
              {item.abaixo_minimo ? <Badge variant="danger">Abaixo do mínimo</Badge> : null}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded-md bg-secondary p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Em estoque</dt>
            <dd className="text-lg font-semibold">
              {formatarQuantidade(item.saldo_total)} {item.unidade}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mínimo</dt>
            <dd className="text-lg font-semibold">
              {Number(item.estoque_minimo) > 0 ? `${formatarQuantidade(item.estoque_minimo)} ${item.unidade}` : "sem alerta"}
            </dd>
          </div>
          {item.tipo_controle === "emprestavel" ? (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Emprestado (fora da sala)</dt>
              <dd className="font-semibold">
                {formatarQuantidade(item.emprestado_em_aberto)} {item.unidade}
              </dd>
            </div>
          ) : null}
        </dl>

        {item.descricao ? <p className="whitespace-pre-line text-sm">{item.descricao}</p> : null}

        {especificacoes.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Especificações</h3>
            <dl className="divide-y rounded-md border text-sm">
              {especificacoes.map((e) => (
                <div key={e.chave} className="flex justify-between gap-2 px-3 py-2">
                  <dt className="text-muted-foreground">{e.chave}</dt>
                  <dd className="text-right">{e.valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Onde está guardado</h3>
          {saldosQ.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {saldosQ.isError && !saldosQ.data ? (
            <p role="alert" className="text-sm text-red-800">
              Não foi possível carregar os endereços: {saldosQ.error.message}
            </p>
          ) : null}
          {saldosQ.data && saldosQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum endereço com saldo.</p>
          ) : null}
          {saldosQ.data && saldosQ.data.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {saldosQ.data.map((s) => (
                <li key={s.endereco_id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{s.codigo}</span>
                    {s.nome ? <span className="text-muted-foreground"> · {s.nome}</span> : null}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatarQuantidade(s.quantidade_atual)} {item.unidade}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {podeEditar ? (
            <>
              <Button variant="outline" onClick={aoEntrada} disabled={item.status !== "ativo"}>
                Registrar entrada
              </Button>
              <Button variant="outline" onClick={aoEditar}>
                Editar
              </Button>
            </>
          ) : null}
          <Button onClick={aoFechar}>Fechar</Button>
        </div>
      </div>
    </Dialogo>
  );
}
