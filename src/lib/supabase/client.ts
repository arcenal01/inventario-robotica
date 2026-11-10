import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_SESSAO, env, urlSupabaseNavegador } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente do Supabase para componentes do navegador ("use client"). Usa só a chave pública. */
export function criarClienteNavegador() {
  return createBrowserClient<Database>(urlSupabaseNavegador(), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookieOptions: COOKIE_SESSAO });
}
