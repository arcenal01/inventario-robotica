// Roda os testes SQL de supabase/testes dentro do banco local (Docker).
// Uso:  npm run db:testes                (todos)
//       npm run db:testes -- bloco3      (só os arquivos que contêm "bloco3")
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA = "supabase/testes";

function containerDoBanco() {
  try {
    const saida = execFileSync(
      "docker",
      ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
      { encoding: "utf8" },
    ).trim();
    return saida.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

const container = containerDoBanco();
if (!container) {
  console.error(
    "Não encontrei o banco local. O Docker Desktop está aberto?\n" +
      "Suba o banco com:  npm run db:start",
  );
  process.exit(1);
}

const filtro = process.argv[2];
const arquivos = readdirSync(PASTA)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !filtro || f.includes(filtro))
  .sort();

if (arquivos.length === 0) {
  console.error("Nenhum arquivo de teste encontrado.");
  process.exit(1);
}

let falhas = 0;
for (const arquivo of arquivos) {
  console.log(`\n=== ${arquivo} ===`);
  const r = spawnSync(
    "docker",
    [
      "exec", "-i", "-e", "PGCLIENTENCODING=UTF8", container,
      "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
    ],
    { input: readFileSync(join(PASTA, arquivo)), encoding: "utf8" },
  );

  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  console.log(saida.trim());

  const deuErro = r.status !== 0;
  const teveFalhou = /FALHOU/.test(saida);
  if (deuErro || teveFalhou) {
    falhas += 1;
    console.log(
      `>>> ${arquivo}: PROBLEMA (${deuErro ? "erro de SQL" : 'linha "FALHOU"'}). Copie a saída acima e me envie.`,
    );
  } else {
    console.log(`>>> ${arquivo}: sem erros e sem "FALHOU".`);
  }
}

console.log(
  falhas === 0
    ? "\nTudo certo. Confira também se os valores 'esperado' batem com os mostrados."
    : `\n${falhas} arquivo(s) com problema.`,
);
process.exit(falhas === 0 ? 0 : 1);
