import { z } from "zod";

const MODELO_CHAVE = "cole-aqui-a-chave-publica";

const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL não é uma URL válida"),
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
