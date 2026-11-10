import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, env, urlSupabaseServidor } from "@/lib/env";
import type { Database } from "@/types/database";

/** Páginas que podem ser abertas sem login. */
const ROTAS_PUBLICAS = ["/entrar", "/cadastro"];

function redirecionar(request: NextRequest, resposta: NextResponse, caminho: string) {
  const url = request.nextUrl.clone();
  url.pathname = caminho;
  url.search = "";
  // 303: mesmo que a requisição tenha sido um POST, o navegador segue com GET.
  const redirecionamento = NextResponse.redirect(url, 303);
  // Preserva os cookies de sessão renovados pelo Supabase.
  resposta.cookies.getAll().forEach((cookie) => redirecionamento.cookies.set(cookie));
  return redirecionamento;
}

/**
 * Renova a sessão (cookies) a cada requisição e faz o redirecionamento básico:
 * sem login -> /entrar; com login em /entrar ou /cadastro -> /.
 * Quem pode ver o quê (perfil e aprovação) é checado nos layouts/páginas (src/lib/auth/perfil.ts).
 */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(urlSupabaseServidor(), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: COOKIE_SESSAO,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida o token no servidor do Supabase (getSession() não valida).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  // O logout (POST /sair) sempre passa, mesmo com a sessão já expirada.
  if (caminho === "/sair") return resposta;
  const publica = ROTAS_PUBLICAS.includes(caminho);

  if (!user && !publica) return redirecionar(request, resposta, "/entrar");
  if (user && publica) return redirecionar(request, resposta, "/");

  return resposta;
}
