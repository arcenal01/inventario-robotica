import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { PapelUsuario, Perfil } from "@/types";

/**
 * Usuário logado + linha dele em "perfis". Só roda no servidor.
 * `cache` evita repetir a consulta quando o layout e a página pedem na mesma requisição.
 */
export const obterUsuarioEPerfil = cache(async () => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, perfil: null as Perfil | null };

  const { data: perfil } = await supabase.from("perfis").select("*").eq("id", user.id).maybeSingle();
  return { user, perfil };
});

/** Garante login + cadastro aprovado. Senão redireciona. */
export async function exigirAprovado(): Promise<Perfil> {
  const { user, perfil } = await obterUsuarioEPerfil();
  if (!user) redirect("/entrar");
  if (!perfil || perfil.status_cadastro !== "aprovado") redirect("/aguardando-aprovacao");
  return perfil;
}

/** Garante que o usuário aprovado tem um dos papéis informados. Senão volta ao início. */
export async function exigirPapel(papeis: PapelUsuario[]): Promise<Perfil> {
  const perfil = await exigirAprovado();
  if (!papeis.includes(perfil.perfil)) redirect("/");
  return perfil;
}
