import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navegacao } from "@/components/navegacao";
import { SinoNotificacoes } from "@/features/notificacoes/sino";
import { itensParaPapel } from "@/lib/navegacao";
import { ROTULO_PAPEL, type Perfil } from "@/types";

export function Cabecalho({ perfil }: { perfil: Perfil }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-card print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <span className="font-semibold">Inventário Robótica</span>
        <Navegacao itens={itensParaPapel(perfil.perfil)} posicao="topo" />
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <p className="max-w-40 truncate text-sm font-medium">{perfil.nome}</p>
          </div>
          <SinoNotificacoes />
          <Badge>{ROTULO_PAPEL[perfil.perfil]}</Badge>
          <form action="/sair" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
