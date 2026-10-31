import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/sessao";

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // Tudo, exceto arquivos estáticos. (Bloco 14 acrescenta manifest e service worker aqui.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
