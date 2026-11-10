// Importação da planilha do site de coleta (inventario-robotica-contagem) para o sistema.
// Sem dependências de tela: testado em tests/importacao.test.mjs.
//
// Entrada: o conteúdo copiado da planilha do Google (colunas separadas por TAB) ou um CSV
// exportado (separador , ou ;). Colunas usadas: Código, Nome, Quantidade, Local, Categoria,
// Observações (e Contada, só para avisar diferença). As outras (Status, ContadaEm...) são ignoradas.

import { normalizar } from "./filtros.ts";
import { REGEX_CODIGO_ITEM, REGEX_PREFIXO } from "./schemas.ts";

export type LinhaPlanilha = {
  /** Número da linha na planilha (1 = cabeçalho), para o aviso apontar onde corrigir */
  linha: number;
  codigo: string;
  nome: string;
  quantidade: number;
  local: string;
  categoria: string;
  obs: string;
  contada: number | null;
};

export type ErroLinha = { linha: number; codigo: string; motivo: string };

export type ResultadoLeitura = { linhas: LinhaPlanilha[]; erros: ErroLinha[] };

const COLUNAS = {
  codigo: ["codigo", "cod", "code"],
  nome: ["nome", "descricao do item", "item"],
  quantidade: ["quantidade", "qtd", "qtde", "quant"],
  local: ["local", "localizacao"],
  categoria: ["categoria"],
  obs: ["observacoes", "observacao", "obs"],
  contada: ["contada"],
} as const;

type Coluna = keyof typeof COLUNAS;

/** Separa uma linha respeitando aspas ("a;b" fica junto; "" vira "). */
function separarCampos(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"' && atual.trim() === "") {
      aspas = true;
      atual = "";
    } else if (c === sep) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** Quebra em linhas sem cortar texto entre aspas que tenha quebra de linha dentro. */
function separarLinhas(texto: string): string[] {
  const linhas: string[] = [];
  let atual = "";
  let aspas = false;
  for (const c of texto.replace(/\r\n?/g, "\n")) {
    if (c === '"') aspas = !aspas;
    if (c === "\n" && !aspas) {
      linhas.push(atual);
      atual = "";
    } else atual += c;
  }
  linhas.push(atual);
  return linhas;
}

function detectarSeparador(cabecalho: string): string {
  if (cabecalho.includes("\t")) return "\t";
  return (cabecalho.match(/;/g)?.length ?? 0) > (cabecalho.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** "12", "12,5", "1.234" (mil), "1.234,5" ou "2.5" -> número; vazio -> null; texto -> NaN */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "");
  if (t === "") return null;
  let br: string;
  if (/,\d+$/.test(t)) br = t.replace(/\./g, "").replace(",", "."); // 1.234,5 -> 1234.5
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) br = t.replace(/\./g, ""); // 1.234 -> 1234 (milhar, padrão do Brasil)
  else br = t; // 12 ou 2.5
  return /^-?\d+(\.\d+)?$/.test(br) ? Number(br) : Number.NaN;
}

export function lerPlanilha(texto: string): ResultadoLeitura {
  const linhasTexto = separarLinhas(texto.replace(/^﻿/, ""));
  const iCab = linhasTexto.findIndex((l) => l.trim() !== "");
  if (iCab < 0) return { linhas: [], erros: [{ linha: 0, codigo: "", motivo: "A planilha está vazia." }] };

  const sep = detectarSeparador(linhasTexto[iCab]);
  const cabecalho = separarCampos(linhasTexto[iCab], sep).map(normalizar);
  const posicao = {} as Record<Coluna, number>;
  for (const coluna of Object.keys(COLUNAS) as Coluna[]) {
    posicao[coluna] = cabecalho.findIndex((c) => (COLUNAS[coluna] as readonly string[]).includes(c));
  }
  const faltando = (["codigo", "nome", "quantidade"] as const).filter((c) => posicao[c] < 0);
  if (faltando.length > 0) {
    return {
      linhas: [],
      erros: [{ linha: iCab + 1, codigo: "", motivo: `Cabeçalho sem a(s) coluna(s): ${faltando.join(", ")}. Copie a planilha com a primeira linha (Código, Nome, Quantidade...).` }],
    };
  }

  const linhas: LinhaPlanilha[] = [];
  const erros: ErroLinha[] = [];
  const vistos = new Map<string, number>();

  for (let i = iCab + 1; i < linhasTexto.length; i++) {
    if (linhasTexto[i].trim() === "") continue;
    const campos = separarCampos(linhasTexto[i], sep);
    const valor = (c: Coluna) => (posicao[c] >= 0 ? (campos[posicao[c]] ?? "") : "");
    const numeroLinha = i + 1;
    const codigo = valor("codigo").replace(/\s+/g, "").toUpperCase();
    const nome = valor("nome").replace(/\s+/g, " ").trim();
    const erro = (motivo: string) => erros.push({ linha: numeroLinha, codigo, motivo });

    if (!codigo && !nome) continue; // linha só com fórmulas ou sobras
    if (!REGEX_CODIGO_ITEM.test(codigo)) {
      erro(codigo ? "Código fora do padrão (ex.: ALI-001: 2 a 5 letras, hífen e 3 dígitos)." : "Linha sem código.");
      continue;
    }
    if (vistos.has(codigo)) {
      erro(`Código repetido na planilha (também na linha ${vistos.get(codigo)}).`);
      continue;
    }
    vistos.set(codigo, numeroLinha);
    if (nome.length < 2 || nome.length > 80) {
      erro(nome.length < 2 ? "Nome vazio." : "Nome com mais de 80 caracteres: encurte na planilha.");
      continue;
    }
    const quantidade = lerNumero(valor("quantidade"));
    if (quantidade === null || Number.isNaN(quantidade) || quantidade < 0) {
      erro("Quantidade vazia ou inválida.");
      continue;
    }
    if (!Number.isInteger(quantidade)) {
      erro('Quantidade quebrada: a importação cadastra em "un" (inteiro). Cadastre este item à mão em m ou kg.');
      continue;
    }
    const contada = lerNumero(valor("contada"));
    linhas.push({
      linha: numeroLinha,
      codigo,
      nome,
      quantidade,
      local: valor("local").replace(/\s+/g, " ").trim(),
      categoria: valor("categoria").replace(/\s+/g, " ").trim(),
      obs: valor("obs").replace(/\s+/g, " ").trim(),
      contada: contada === null || Number.isNaN(contada) ? null : contada,
    });
  }
  return { linhas, erros };
}

// ---------------------------------------------------------------------
// Categorias: cada texto da coluna Categoria vira uma categoria do sistema
// ---------------------------------------------------------------------

type CategoriaExistente = { id: string; nome: string; prefixo: string };

export type DestinoCategoria =
  | { tipo: "existente"; categoriaId: string }
  | { tipo: "nova"; nome: string; prefixo: string };

export type GrupoCategoria = {
  /** Texto como veio da planilha ("" = sem categoria) */
  texto: string;
  quantidadeItens: number;
  destino: DestinoCategoria;
  tipoControle: "consumivel" | "emprestavel";
};

/** Ferramentas, equipamentos, instrumentos e kits costumam sair e voltar (empréstimo). */
export function tipoControleSugerido(nomeCategoria: string): "consumivel" | "emprestavel" {
  return /ferrament|equipament|instrument|kit|caixa|epi/.test(normalizar(nomeCategoria)) ? "emprestavel" : "consumivel";
}

/** Prefixo livre para uma categoria nova: 3 primeiras letras sem acento; se já existir, tenta outras. */
export function sugerirPrefixo(nome: string, usados: Set<string>): string {
  const letras = normalizar(nome).toUpperCase().replace(/[^A-Z]/g, "");
  const base = (letras || "CAT").padEnd(2, "X");
  const candidatos = [base.slice(0, 3), base.slice(0, 4), base.slice(0, 5)];
  for (let i = 3; i < base.length; i++) candidatos.push(base.slice(0, 2) + base[i]);
  for (const c of candidatos) if (REGEX_PREFIXO.test(c) && !usados.has(c)) return c;
  for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const c = base.slice(0, 2) + a + "X";
    if (!usados.has(c)) return c;
  }
  return "CATX";
}

/** Agrupa as categorias da planilha e sugere o destino: categoria com o mesmo nome ou prefixo, senão uma nova. */
export function agruparCategorias(linhas: LinhaPlanilha[], existentes: CategoriaExistente[]): GrupoCategoria[] {
  const grupos = new Map<string, { texto: string; quantidadeItens: number }>();
  for (const l of linhas) {
    const chave = normalizar(l.categoria);
    const g = grupos.get(chave) ?? { texto: l.categoria, quantidadeItens: 0 };
    g.quantidadeItens++;
    grupos.set(chave, g);
  }

  const usados = new Set(existentes.map((c) => c.prefixo));
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([chave, g]) => {
      const igual =
        existentes.find((c) => normalizar(c.nome) === (chave || "outros")) ??
        existentes.find((c) => c.prefixo === g.texto.trim().toUpperCase());
      let destino: DestinoCategoria;
      if (igual) {
        destino = { tipo: "existente", categoriaId: igual.id };
      } else {
        const nome = (g.texto || "Outros").slice(0, 40);
        const prefixo = sugerirPrefixo(nome, usados);
        usados.add(prefixo);
        destino = { tipo: "nova", nome, prefixo };
      }
      const nomeParaTipo = igual ? igual.nome : g.texto;
      return { texto: g.texto, quantidadeItens: g.quantidadeItens, destino, tipoControle: tipoControleSugerido(nomeParaTipo) };
    });
}

/** Confere as categorias novas: prefixo válido e sem repetir (entre si e com as existentes). */
export function validarCategorias(grupos: GrupoCategoria[], existentes: CategoriaExistente[]): string[] {
  const problemas: string[] = [];
  const prefixos = new Map(existentes.map((c) => [c.prefixo, `categoria ${c.nome}`]));
  const nomes = new Map(existentes.map((c) => [normalizar(c.nome), c.nome]));
  for (const g of grupos) {
    if (g.destino.tipo !== "nova") continue;
    const rotulo = g.texto || "(sem categoria)";
    const { nome, prefixo } = g.destino;
    if (nome.trim().length < 2 || nome.trim().length > 40) problemas.push(`${rotulo}: o nome precisa ter de 2 a 40 caracteres.`);
    if (!REGEX_PREFIXO.test(prefixo)) problemas.push(`${rotulo}: prefixo ${prefixo || "vazio"} inválido (2 a 5 letras).`);
    else if (prefixos.has(prefixo)) problemas.push(`${rotulo}: o prefixo ${prefixo} já é usado (${prefixos.get(prefixo)}).`);
    else prefixos.set(prefixo, `categoria nova ${nome}`);
    const chave = normalizar(nome);
    if (nomes.has(chave)) problemas.push(`${rotulo}: já existe a categoria ${nomes.get(chave)}; escolha-a na lista.`);
    else nomes.set(chave, nome);
  }
  return problemas;
}

// ---------------------------------------------------------------------
// Locais: cada texto da coluna Local pode virar uma posição (para lançar o estoque)
// ---------------------------------------------------------------------

export type GrupoLocal = { texto: string; quantidadeItens: number };

export function agruparLocais(linhas: LinhaPlanilha[]): GrupoLocal[] {
  const grupos = new Map<string, GrupoLocal>();
  for (const l of linhas) {
    const chave = normalizar(l.local);
    const g = grupos.get(chave) ?? { texto: l.local, quantidadeItens: 0 };
    g.quantidadeItens++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR", { numeric: true }));
}

export function chaveLocal(texto: string): string {
  return normalizar(texto);
}

export function chaveCategoria(texto: string): string {
  return normalizar(texto);
}

// ---------------------------------------------------------------------
// Plano final: o que cada linha vai virar
// ---------------------------------------------------------------------

export type ItemParaImportar = LinhaPlanilha & {
  situacao: "novo" | "ja_existe";
  descricao: string | null;
  /** Diferença entre Quantidade e Contada na coleta (só aviso; a importação usa Quantidade) */
  avisoContagem: string | null;
};

/** Descrição gravada no item: observações + o local anotado na coleta (até 500 caracteres). */
export function montarDescricao(obs: string, local: string): string | null {
  const partes = [obs, local ? `Local na coleta: ${local}` : ""].filter(Boolean);
  if (partes.length === 0) return null;
  const texto = partes.join("\n");
  return texto.length <= 500 ? texto : `${texto.slice(0, 497)}...`;
}

export function planejarItens(linhas: LinhaPlanilha[], codigosExistentes: Set<string>): ItemParaImportar[] {
  return linhas.map((l) => ({
    ...l,
    situacao: codigosExistentes.has(l.codigo) ? "ja_existe" : "novo",
    descricao: montarDescricao(l.obs, l.local),
    avisoContagem:
      l.contada !== null && l.contada !== l.quantidade ? `Na coleta foram contados ${l.contada} (planilha diz ${l.quantidade}).` : null,
  }));
}
