import Dexie, { type EntityTable } from "dexie";
import type { EnvioFila } from "./regras";

// Banco no próprio aparelho (IndexedDB, pela biblioteca Dexie). Um banco POR USUÁRIO: quem entrar depois no mesmo
// navegador não enxerga os dados de outra pessoa pelo app. Ao Sair, o banco da pessoa é apagado.

export type ConsultaGuardada = { chave: string; queryKey: unknown[]; dados: unknown; atualizadoEm: number };
export type Meta = { nome: string; valor: number };

export class BancoOffline extends Dexie {
  consultas!: EntityTable<ConsultaGuardada, "chave">;
  fila!: EntityTable<EnvioFila, "chave">;
  meta!: EntityTable<Meta, "nome">;

  constructor(nome: string) {
    super(nome);
    this.version(1).stores({
      consultas: "chave",
      fila: "chave, estado, criadoEm",
      meta: "nome",
    });
  }
}

export const PREFIXO_BANCO = "inventario-";

let atual: BancoOffline | null = null;

/** Abre (ou reaproveita) o banco do usuário. Só no navegador. */
export function abrirBanco(usuarioId: string): BancoOffline {
  const nome = `${PREFIXO_BANCO}${usuarioId}`;
  if (atual?.name !== nome) {
    atual?.close();
    atual = new BancoOffline(nome);
  }
  return atual;
}

/** Banco aberto agora (null antes do login ou no servidor). */
export function bancoAtual(): BancoOffline | null {
  return atual;
}

/** Apaga o banco do usuário atual (ao Sair). Nunca trava o logout: erro aqui é ignorado. */
export async function apagarBancoAtual(): Promise<void> {
  const banco = atual;
  atual = null;
  if (!banco) return;
  try {
    await banco.delete();
  } catch {
    // aparelho sem IndexedDB ou banco já apagado
  }
}
