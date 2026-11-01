import { z } from "zod";

const MODELO_CHAVE = "cole-aqui-a-chave-publica";

/**
 * NEXT_PUBLIC_SUPABASE_URL aceita:
 * - uma URL completa (ex.: http://127.0.0.1:54321 ou https://projeto.supabase.co): o navegador fala direto com o Supabase;
 * - um caminho do próprio app (ex.: /supabase): o navegador fala com o app, que repassa ao Supabase
 *   (next.config.ts). Assim o celular só precisa enxergar o endereço do app (rede local, túnel, https).
 *   Nesse caso o servidor usa SUPABASE_URL_INTERNO para chegar ao Supabase.
 */
const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .refine((v) => /^\/[a-z0-9-]+$/.test(v) || z.string().url().safeParse(v).success, "NEXT_PUBLIC_SUPABASE_URL deve ser uma URL ou um caminho como /supabase"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia")
    .refine((v) => v !== MODELO_CHAVE, "Troque o texto de exemplo pela chave pública (npm run db:status)"),
});

// O Next.js só embute variáveis NEXT_PUBLIC_ quando elas são lidas assim, uma a uma.
const resultado = esquema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!resultado.success) {
  const problemas = resultado.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(
    `Variáveis de ambiente inválidas:\n${problemas}\n` +
      "Copie .env.example para .env.local e preencha (veja docs/07-base-nextjs.md).",
  );
}

export const env = resultado.data;

/** true quando o navegador fala com o Supabase através do próprio app (caminho relativo). */
export const supabaseViaApp = env.NEXT_PUBLIC_SUPABASE_URL.startsWith("/");

/** Endereço do Supabase visto pelo NAVEGADOR (no modo via app: origem atual + caminho). */
export function urlSupabaseNavegador(): string {
  if (!supabaseViaApp) return env.NEXT_PUBLIC_SUPABASE_URL;
  // Componentes "use client" também rodam uma vez no servidor (pré-renderização): lá não existe window
  if (typeof window === "undefined") return urlSupabaseServidor();
  return window.location.origin + env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Endereço do Supabase visto pelo SERVIDOR do Next.js (só roda no servidor). */
export function urlSupabaseServidor(): string {
  if (!supabaseViaApp) return env.NEXT_PUBLIC_SUPABASE_URL;
  const interno = process.env.SUPABASE_URL_INTERNO;
  if (!interno) throw new Error("Com NEXT_PUBLIC_SUPABASE_URL=/supabase, preencha SUPABASE_URL_INTERNO (ex.: http://127.0.0.1:54321).");
  return interno;
}

/**
 * Nome fixo do cookie de sessão. Sem isso o Supabase deriva o nome do endereço,
 * e navegador (endereço do túnel) e servidor (127.0.0.1) usariam nomes diferentes.
 */
export const COOKIE_SESSAO = { name: "sb-inventario-auth-token" };
