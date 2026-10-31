// Mensagens de erro do banco/rede em português simples para a tela.
// As funções RPC já respondem em português ("Saldo insuficiente..."): essas passam direto.

export function traduzirErroBanco(mensagem: string | null | undefined): string {
  const m = mensagem ?? "";
  if (!m) return "Não foi possível concluir. Tente de novo.";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Sem conexão com o servidor. Confira o Wi-Fi e tente de novo.";
  if (/row-level security|permission denied/i.test(m)) return "Sem permissão para esta ação.";
  if (/duplicate key/i.test(m)) return "Este registro já existe.";
  if (/violates check constraint/i.test(m)) return "Algum valor não é aceito. Confira os campos.";
  return m;
}
