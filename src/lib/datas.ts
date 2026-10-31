// Datas no horário de Brasília (o banco também calcula atraso assim: hoje_br()).

const FUSO = "America/Sao_Paulo";

/** Hoje em Brasília no formato AAAA-MM-DD (o mesmo do <input type="date"> e do banco). */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** "2026-10-31" -> "31/10/2026" (data sem hora, não sofre com fuso). */
export function formatarData(data: string | null | undefined): string {
  if (!data) return "";
  const [a, m, d] = data.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Data e hora de um timestamp do banco, em Brasília: "31/10/2026 14:05". */
export function formatarDataHora(instante: string | null | undefined): string {
  if (!instante) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instante));
}

/** Dias de atraso de um prazo (0 se não venceu ou não tem prazo). */
export function diasDeAtraso(prazo: string | null | undefined, hoje: string = hojeBrasilia()): number {
  if (!prazo || prazo >= hoje) return 0;
  const dia = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((dia(hoje) - dia(prazo)) / 86_400_000);
}

/** Início do dia N dias atrás em Brasília, como ISO, para filtrar por período. */
export function inicioDeDiasAtras(dias: number, agora: Date = new Date()): string {
  const hoje = hojeBrasilia(new Date(agora.getTime() - dias * 86_400_000));
  return `${hoje}T00:00:00-03:00`;
}
