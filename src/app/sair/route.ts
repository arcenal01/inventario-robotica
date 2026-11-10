import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  // 303: depois de um POST, o navegador segue com GET.
  // Endereço RELATIVO: atrás do túnel o servidor se vê como localhost, mas o navegador está no endereço https do túnel.
  return new NextResponse(null, { status: 303, headers: { Location: "/entrar" } });
}
