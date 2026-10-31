// Interpreta o código lido no QR (ou digitado) e acha o endereço. Sem dependências de tela:
// testado em tests/contagens.test.mjs.

/** O QR das etiquetas guarda só o código (ex.: ARM01-GAV03-P05). Digitado: ignora espaços e maiúsculas. */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\s+/g, "").toUpperCase();
}

type EnderecoBasico = { id: string; codigo: string; ativo: boolean; substituido_por_id: string | null };

export type ResultadoCodigo<E extends EnderecoBasico> =
  | { tipo: "vazio" }
  | { tipo: "nao_encontrado"; codigo: string }
  | { tipo: "ativo"; endereco: E }
  | { tipo: "inativo"; endereco: E }
  /** Etiqueta antiga: o endereço foi trocado (troca de QR). `atual` é o último da cadeia de trocas. */
  | { tipo: "substituido"; antigo: E; atual: E };

export function resolverEndereco<E extends EnderecoBasico>(lista: E[], texto: string): ResultadoCodigo<E> {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return { tipo: "vazio" };
  const porCodigo = new Map(lista.map((e) => [e.codigo.toUpperCase(), e]));
  const encontrado = porCodigo.get(codigo);
  if (!encontrado) return { tipo: "nao_encontrado", codigo };
  if (!encontrado.substituido_por_id) return encontrado.ativo ? { tipo: "ativo", endereco: encontrado } : { tipo: "inativo", endereco: encontrado };

  // Segue as trocas (A -> B -> C) até o endereço atual; o limite evita laço infinito se os dados estiverem errados
  const porId = new Map(lista.map((e) => [e.id, e]));
  let atual = encontrado;
  for (let i = 0; i < 50 && atual.substituido_por_id; i++) {
    const proximo = porId.get(atual.substituido_por_id);
    if (!proximo) break;
    atual = proximo;
  }
  return { tipo: "substituido", antigo: encontrado, atual };
}
