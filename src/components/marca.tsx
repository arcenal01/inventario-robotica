import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logo: ícone de robô num quadrado com degradê + nome. */
export function Marca({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.6_0.2_270)] text-primary-foreground shadow-glow">
        <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      {compacta ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Inventário</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-primary">Robótica</span>
        </span>
      )}
    </span>
  );
}
