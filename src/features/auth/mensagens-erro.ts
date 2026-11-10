/** Traduz mensagens de erro do Supabase Auth (em inglês) para o usuário. */
export function traduzirErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já está cadastrado.";
  if (m.includes("password should be")) return "Senha fraca ou curta demais. Use pelo menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com o servidor. Confira o Wi-Fi e tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
}
