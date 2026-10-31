import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  // 303: depois de um POST, o navegador deve seguir o redirecionamento com GET.
  return NextResponse.redirect(new URL("/entrar", request.url), { status: 303 });
}
