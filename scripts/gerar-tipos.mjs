// Gera src/types/database.ts a partir do banco local (Docker precisa estar rodando).
// Uso:  npm run db:tipos
// Por que um script e não "supabase gen types ... > arquivo"? No PowerShell do Windows o ">"
// grava o arquivo em UTF-16 e quebra o TypeScript. Aqui gravamos em UTF-8.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const r = spawnSync("npx supabase gen types typescript --local", {
  shell: true,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

if (r.status !== 0 || !r.stdout || !r.stdout.includes("export type Database")) {
  console.error("Não consegui gerar os tipos. O banco está ligado? (npm run db:start)\n");
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

const cabecalho =
  "// ARQUIVO GERADO: não edite à mão. Para atualizar depois de mudar o banco, rode: npm run db:tipos\n\n";

const rodape = `
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]
`;

// A saída oficial já traz helpers Tables/Enums; só acrescentamos os que faltarem.
let saida = r.stdout;
for (const nome of ["Tables", "TablesInsert", "TablesUpdate", "Enums"]) {
  if (!new RegExp(`export type ${nome}<`).test(saida)) {
    const linha = rodape.split("\n").find((l) => l.startsWith(`export type ${nome}<`));
    if (linha) saida += `\n${linha}`;
  }
}

writeFileSync("src/types/database.ts", cabecalho + saida + "\n", "utf8");
console.log("Tipos gerados em src/types/database.ts");
