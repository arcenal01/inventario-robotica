import type { NextConfig } from "next";

// Para abrir o app pelo celular em desenvolvimento, informe o IP do computador em DEV_ORIGINS
// (ex.: DEV_ORIGINS=192.168.0.20). Ver docs/07-base-nextjs.md.
const origensDev = process.env.DEV_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Modo "Supabase pelo app" (NEXT_PUBLIC_SUPABASE_URL=/supabase): o app repassa /supabase/* ao Supabase.
// O celular só precisa enxergar o endereço do app (rede local ou túnel https). Ver docs/14-pwa-https.md.
const caminhoSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("/") ? process.env.NEXT_PUBLIC_SUPABASE_URL : null;
const supabaseInterno = process.env.SUPABASE_URL_INTERNO?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(origensDev?.length ? { allowedDevOrigins: origensDev } : {}),
  async rewrites() {
    if (!caminhoSupabase || !supabaseInterno) return [];
    return [{ source: `${caminhoSupabase}/:caminho*`, destination: `${supabaseInterno}/:caminho*` }];
  },
  async headers() {
    // O service worker nunca fica em cache do navegador: versão nova vale na hora
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
