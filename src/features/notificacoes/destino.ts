// Para onde cada notificação leva. Sem dependências de tela (testado em tests/pedidos.test.mjs).

export function destinoNotificacao(n: { referencia_tabela: string | null; referencia_id: string | null }): string | null {
  if (n.referencia_tabela === "pedidos" && n.referencia_id) return `/pedidos/${n.referencia_id}`;
  if (n.referencia_tabela === "trocas_qr") return "/enderecos/trocas";
  if (n.referencia_tabela === "romaneios" && n.referencia_id) return `/romaneios/${n.referencia_id}`;
  return null;
}
