import { LogOut } from "lucide-react";
import Link from "next/link";
import { BotaoTema } from "@/components/botao-tema";
import { Marca } from "@/components/marca";
import { Navegacao } from "@/components/navegacao";
import { SinoNotificacoes } from "@/features/notificacoes/sino";
import { itensParaPapel } from "@/lib/navegacao";
import { ROTULO_PAPEL, type Perfil } from "@/types";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function Avatar({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-1 ring-border"
    >
      {iniciais(nome)}
    </span>
  );
}

function BotaoSair({ comTexto = false }: { comTexto?: boolean }) {
  return (
    <form action="/sair" method="post">
      <button
        type="submit"
        title="Sair"
        aria-label="Sair"
        className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {comTexto ? <span>Sair</span> : null}
      </button>
    </form>
  );
}

/** Computador: barra lateral fixa com marca, menu e usuário. */
export function BarraLateral({ perfil }: { perfil: Perfil }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar md:flex print:hidden">
      <Link href="/" className="flex h-16 items-center px-5">
        <Marca />
      </Link>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Menu</p>
        <Navegacao itens={itensParaPapel(perfil.perfil)} posicao="lateral" />
      </div>
      <div className="space-y-2 border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Avatar nome={perfil.nome} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium">{perfil.nome}</span>
            <span className="block text-xs text-muted-foreground">{ROTULO_PAPEL[perfil.perfil]}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <BotaoTema comTexto />
          <BotaoSair />
        </div>
      </div>
    </aside>
  );
}

/** Topo: no celular mostra a marca; em todos, sino, tema e sair (no computador o usuário fica na lateral). */
export function Cabecalho({ perfil }: { perfil: Perfil }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/75 backdrop-blur-lg print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 md:h-16 md:px-8">
        <Link href="/" className="md:hidden">
          <Marca />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <SinoNotificacoes />
          <BotaoTema className="md:hidden" />
          <span className="ml-1 md:hidden">
            <Avatar nome={perfil.nome} />
          </span>
          <span className="md:hidden">
            <BotaoSair />
          </span>
        </div>
      </div>
    </header>
  );
}
