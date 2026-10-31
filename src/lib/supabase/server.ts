import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente do Supabase para Server Components, Server Actions e Route Handlers. */
export async function criarClienteServidor() {
  const armazem = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return armazem.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => armazem.set(name, value, options));
        } catch {
          // Chamado de um Server Component (que não pode gravar cookies): sem problema,
          // o middleware já renova a sessão a cada requisição.
        }
      },
    },
  });
}
