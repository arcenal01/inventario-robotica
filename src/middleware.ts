import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/sessao";

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // Tudo, exceto arquivos estáticos, o PWA (manifest, service worker, ícones, página offline)
  // e /supabase (o próprio Supabase confere a sessão nas chamadas repassadas).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icones/|offline.html|supabase/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
