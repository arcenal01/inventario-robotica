// Teste de ponta a ponta do Inventário Robótica (Bloco 16A): abre o sistema num navegador de verdade (Edge),
// percorre as telas como professor e aluno, cadastra, importa, etiqueta e testa o aviso de 'acabou'.
// Precisa do site no ar (npm run producao) e do banco (npm run db:start). Veja docs/16a-testes.md.
// Uso:  npm run e2e   (na primeira vez: npm install --no-save playwright-core)
let chromium;
try { ({ chromium } = await import("playwright-core")); } catch { console.error("Falta a ferramenta de teste. Rode uma vez:  npm install --no-save playwright-core"); process.exit(2); }
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = "http://localhost:3000";
const API = "http://127.0.0.1:54321";
const CHAVE = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"; // chave pública do Supabase local (padrão de teste)
const SENHA = "Teste@12345";
const PASTA = join(tmpdir(), "inventario-e2e"); // fotos de teste, prints e resultado.json
mkdirSync(PASTA, { recursive: true });

const resultados = [];
const ok = (nome, extra = "") => { resultados.push({ nome, ok: true, extra }); console.log(`PASSOU  ${nome}${extra ? " — " + extra : ""}`); };
const falha = (nome, extra = "") => { resultados.push({ nome, ok: false, extra }); console.log(`FALHOU  ${nome}${extra ? " — " + extra : ""}`); };
async function passo(nome, fn) {
  try { const extra = await fn(); ok(nome, extra ?? ""); } catch (e) { falha(nome, String(e.message ?? e).split("\n")[0]); }
}

// Prefixo único por execução (2 a 5 letras): rodar de novo não colide com o que já foi criado
const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const rnd = () => letras[Math.floor(Math.random() * 26)];
const P = `Z${rnd()}${rnd()}${rnd()}`;

const ROTAS = [
  "/", "/itens", "/itens/categorias", "/itens/importar", "/itens/etiquetas?todos=1", "/pedidos", "/pedidos/novo",
  "/emprestimos", "/contagens", "/romaneios", "/romaneios/novo", "/movimentacoes", "/relatorios", "/enderecos",
  "/enderecos/tipos", "/enderecos/trocas", "/enderecos/etiquetas?todos=1", "/usuarios", "/notificacoes", "/pendencias", "/menu",
];

const navegador = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

async function entrar(email, viewport = { width: 1280, height: 900 }) {
  const contexto = await navegador.newContext({ viewport, locale: "pt-BR", permissions: ["camera"] });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  pagina.on("console", (m) => { if (m.type() === "error") erros.push(`console: ${m.text()}`); });
  await pagina.goto(`${SITE}/entrar`, { waitUntil: "networkidle" });
  await pagina.fill("#email", email);
  await pagina.fill("#senha", SENHA);
  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
  await pagina.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 30000 });
  await pagina.waitForLoadState("networkidle");
  return { contexto, pagina, erros };
}

async function token(email) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: CHAVE, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: SENHA }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login REST falhou: ${JSON.stringify(j).slice(0, 120)}`);
  return j.access_token;
}
async function rest(tk, caminho, metodo = "GET", corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { apikey: CHAVE, Authorization: `Bearer ${tk}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${t.slice(0, 150)}`);
  return t ? JSON.parse(t) : null;
}

// ---------------------------------------------------------------- 1) telas
async function varrer(rotulo, email, viewport) {
  const { contexto, pagina, erros } = await entrar(email, viewport);
  for (const rota of ROTAS) {
    erros.length = 0;
    await passo(`${rotulo}: abre ${rota}`, async () => {
      const resp = await pagina.goto(`${SITE}${rota}`, { waitUntil: "networkidle", timeout: 45000 });
      if (!resp || resp.status() >= 400) throw new Error(`status ${resp?.status()}`);
      await pagina.waitForTimeout(300);
      if (erros.length) throw new Error(erros[0].slice(0, 160));
      if (viewport.width < 600) {
        const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (sobra > 1) throw new Error(`rolagem horizontal de ${sobra}px`);
      }
      const redirecionou = new URL(pagina.url()).pathname !== new URL(`${SITE}${rota}`).pathname;
      return redirecionou ? `redirecionou para ${new URL(pagina.url()).pathname}` : "";
    });
  }
  await contexto.close();
}

console.log("\n=== 1) Todas as telas ===");
await varrer("professor (PC)", "prof@escola.local", { width: 1280, height: 900 });
await varrer("professor (celular 390px)", "prof@escola.local", { width: 390, height: 844 });
await varrer("aluno (celular 390px)", "aluno1@escola.local", { width: 390, height: 844 });

// ---------------------------------------------------------------- 2) fluxos do professor
console.log("\n=== 2) Fluxos do professor ===");
const { contexto, pagina, erros } = await entrar("prof@escola.local");
const nomeUm = `[E2E] Alicate ${P}`;
let codigoUm = "";

const png = join(PASTA, "foto-teste.png");
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64"));

await passo(`cadastro com prefixo próprio (${P}) e foto`, async () => {
  await pagina.goto(`${SITE}/itens`, { waitUntil: "networkidle" });
  await pagina.getByRole("button", { name: "Novo item" }).click();
  await pagina.fill("#nome", nomeUm);
  await pagina.fill("#prefixo_codigo", P.toLowerCase());
  await pagina.locator('input[type="file"][capture]').setInputFiles(png);
  await pagina.waitForSelector('img[alt="Foto do item"]', { timeout: 15000 });
  await pagina.getByRole("button", { name: "Salvar" }).click();
  const msg = pagina.getByRole("status").filter({ hasText: "Item cadastrado" });
  await msg.waitFor({ timeout: 30000 });
  const texto = await msg.innerText();
  codigoUm = (texto.match(/([A-Z]{2,5}-\d+)/) ?? [])[1] ?? "";
  if (codigoUm !== `${P}-001`) throw new Error(`esperado ${P}-001, veio "${texto}"`);
  if (/foto não foi salva/i.test(texto)) throw new Error(texto);
  return codigoUm;
});

await passo("segundo item com o mesmo prefixo vira -002", async () => {
  await pagina.getByRole("button", { name: "Novo item" }).click();
  await pagina.fill("#nome", `[E2E] Outro ${P}`);
  await pagina.fill("#prefixo_codigo", P);
  await pagina.getByRole("button", { name: "Salvar" }).click();
  // a mensagem verde do cadastro anterior ainda pode estar na tela: espera a do -002
  const msg = pagina.getByRole("status").filter({ hasText: `${P}-002` });
  await msg.waitFor({ timeout: 30000 });
  return `${P}-002`;
});

await passo("prefixo inválido (A1) é recusado na tela", async () => {
  await pagina.getByRole("button", { name: "Novo item" }).click();
  await pagina.fill("#nome", "[E2E] Inválido");
  await pagina.fill("#prefixo_codigo", "A1");
  await pagina.getByRole("button", { name: "Salvar" }).click();
  await pagina.getByText("Use de 2 a 5 letras").waitFor({ timeout: 10000 });
  await pagina.getByRole("button", { name: "Cancelar" }).click();
});

await passo("foto aparece na lista e na ficha do item", async () => {
  await pagina.goto(`${SITE}/itens`, { waitUntil: "networkidle" });
  await pagina.getByPlaceholder("Buscar por código, nome ou descrição").fill(codigoUm);
  const linha = pagina.getByRole("button").filter({ hasText: nomeUm });
  await linha.waitFor({ timeout: 15000 });
  const temMiniatura = await linha.locator("img").count();
  if (!temMiniatura) throw new Error("sem miniatura na lista");
  await linha.click();
  await pagina.locator(`img[alt="Foto de ${nomeUm}"]`).waitFor({ timeout: 15000 });
  const carregou = await pagina.locator(`img[alt="Foto de ${nomeUm}"]`).evaluate((i) => i.complete && i.naturalWidth > 0);
  if (!carregou) throw new Error("a imagem da ficha não carregou");
});

await passo("ficha do item: etiqueta com QR", async () => {
  await pagina.getByRole("link", { name: "Etiqueta QR" }).click();
  await pagina.waitForURL(/\/itens\/etiquetas/);
  await pagina.locator("svg").first().waitFor({ timeout: 15000 });
  const t = await pagina.locator("body").innerText();
  if (!t.includes(codigoUm)) throw new Error(`código ${codigoUm} não aparece na etiqueta`);
  await pagina.screenshot({ path: join(PASTA, "etiqueta.png") });
});

await passo("botão Ler QR abre a câmera (câmera de teste)", async () => {
  await pagina.goto(`${SITE}/itens`, { waitUntil: "networkidle" });
  await pagina.getByRole("button", { name: "Ler QR" }).click();
  await pagina.getByRole("dialog").waitFor({ timeout: 10000 });
  await pagina.waitForSelector("video", { timeout: 15000 });
  await pagina.getByRole("button", { name: "Cancelar" }).click();
});

// Importação (códigos novos por execução)
const planilha = [
  "Código\tNome\tQuantidade\tLocal\tCategoria\tObservações\tContada\tStatus\tContadaEm\tEditadoEm",
  `${P}A-001\t[E2E] CHAVE PHILIPS ${P}\t12\tARMARIO 4 GAVETA C2\tCHAV\t\t\t#ERROR!\t\t2026-10-29T17:37:01.568Z`,
  `${P}B-001\t[E2E] Multímetro ${P}\t1\tArmario 4 Caixa F\tEquipamento\t\t\t#ERROR!\t\t2026-10-29T17:12:27.366Z`,
  `${P}C-001\t[E2E] ESTAÇÃO DE SOLDA ${P}\t5\tARMARIO 6\tEquipamento\tSUGON T26D\t4\t#ERROR!\t\t2026-11-05T17:22:49.397Z`,
  `${P}D-1\t[E2E] código ruim\t1\tARMARIO 6\tEquipamento`,
].join("\n");
let nomeParaEsgotar = `[E2E] CHAVE PHILIPS ${P}`; // consumível (categoria CHAV): pode dar saída

await passo("importação: lê a planilha e aponta a linha com erro", async () => {
  await pagina.goto(`${SITE}/itens/importar`, { waitUntil: "networkidle" });
  await pagina.getByLabel("Conteúdo da planilha").fill(planilha);
  await pagina.getByText("item(ns) lido(s)").waitFor({ timeout: 15000 });
  const t = await pagina.locator("main, body").first().innerText();
  if (!/3\s*item\(ns\) lido/.test(t)) throw new Error("não leu 3 itens: " + t.slice(0, 200));
  if (!/Linha 5/.test(t)) throw new Error("não apontou a linha 5 com código ruim");
  return "3 lidos, linha 5 recusada";
});

await passo("importação: liga um local a uma posição e importa", async () => {
  // Liga dois locais a posições: ARMARIO 6 (estação de solda, emprestável) e GAVETA C2 (chave, consumível)
  for (const local of ["ARMARIO 6", "ARMARIO 4 GAVETA C2"]) {
    const seletor = pagina.getByLabel(`Posição para ${local}`);
    const opcoes = await seletor.locator("option").count();
    if (opcoes < 2) throw new Error("não há posições cadastradas (seed)");
    await seletor.selectOption({ index: 1 });
  }
  const botao = pagina.getByRole("button", { name: /Importar 3 item/ });
  await botao.waitFor({ timeout: 10000 });
  if (await botao.isDisabled()) throw new Error("botão Importar desabilitado: " + (await pagina.getByRole("alert").allInnerTexts()).join(" | "));
  await botao.click();
  await pagina.getByText(/importado\(s\) sem problema/).waitFor({ timeout: 90000 });
  const t = await pagina.locator("body").innerText();
  if (!/3 de 3 item\(ns\) importado/.test(t)) throw new Error(t.slice(0, 300));
  if (!t.includes(`${P}C-001`) || !/Cadastrado com 5 em /.test(t)) throw new Error("estação de solda sem entrada de 5 na posição");
  if (!/Cadastrado com 12 em /.test(t)) throw new Error("chave philips sem entrada de 12 na posição");
  return "3 de 3, estoque lançado em 2 itens";
});

await passo("importar a mesma planilha de novo: tudo já cadastrado", async () => {
  await pagina.goto(`${SITE}/itens/importar`, { waitUntil: "networkidle" });
  await pagina.getByLabel("Conteúdo da planilha").fill(planilha);
  await pagina.getByText("item(ns) lido(s)").waitFor({ timeout: 15000 });
  const t = await pagina.locator("body").innerText();
  if (!/3 já cadastrado/.test(t)) throw new Error("não reconheceu os já cadastrados");
  if (!(await pagina.getByRole("button", { name: /Importar 0 item/ }).isDisabled())) throw new Error("botão deveria estar desabilitado");
});

// Aviso de "acabou" (saída pela API do banco, como a tela faria)
await passo("aviso 'acabou o estoque' no Início, depois 'Não terá mais'", async () => {
  const tk = await token("prof@escola.local");
  const [item] = await rest(tk, `/rest/v1/itens?codigo=eq.${P}A-001&select=id`);
  const [saldo] = await rest(tk, `/rest/v1/saldos_por_endereco?item_id=eq.${item.id}&select=endereco_id,quantidade_atual`);
  await rest(tk, "/rest/v1/rpc/registrar_saida", "POST", {
    p_item_id: item.id, p_endereco_id: saldo.endereco_id, p_quantidade: Number(saldo.quantidade_atual),
    p_chave_idempotencia: crypto.randomUUID(), p_motivo: "teste e2e",
  });
  await pagina.goto(`${SITE}/`, { waitUntil: "networkidle" });
  await pagina.getByText("Acabou o estoque: repor").waitFor({ timeout: 15000 });
  if (!(await pagina.getByText(`${P}A-001`).count())) throw new Error("o item que acabou não aparece na lista do Início");
  await pagina.goto(`${SITE}/itens`, { waitUntil: "networkidle" });
  await pagina.getByPlaceholder("Buscar por código, nome ou descrição").fill(`${P}A-001`);
  const linha = pagina.getByRole("button").filter({ hasText: nomeParaEsgotar });
  await linha.waitFor({ timeout: 15000 });
  if (!(await linha.getByText("Acabou: repor").count())) throw new Error("sem o selo 'Acabou: repor' na lista");
  await linha.click();
  await pagina.getByText("Acabou o estoque: avise para repor.").waitFor({ timeout: 10000 });
  await pagina.getByRole("button", { name: "Não terá mais" }).click();
  await pagina.getByText("Acabou e não terá mais no estoque.").waitFor({ timeout: 15000 });
  await pagina.getByRole("button", { name: "Voltar a repor" }).waitFor({ timeout: 5000 });
  // Fechar e conferir que o Início não avisa mais desse item
  await pagina.getByRole("button", { name: "Fechar" }).click();
  await pagina.goto(`${SITE}/`, { waitUntil: "networkidle" });
  if (await pagina.getByText(`${P}A-001`).count()) throw new Error("item 'não terá mais' ainda aparece no aviso do Início");
  await pagina.getByRole("button", { name: /Voltar|Início/ }).first().isVisible().catch(() => {});
});

await passo("nenhum erro de JavaScript no console durante os fluxos", async () => {
  if (erros.length) throw new Error(erros.slice(0, 2).join(" || ").slice(0, 300));
});
await contexto.close();

// ---------------------------------------------------------------- 3) aluno não pode o que é da equipe
console.log("\n=== 3) Permissões do aluno ===");
const aluno = await entrar("aluno1@escola.local");
await passo("aluno é mandado de volta ao Início ao abrir Importar planilha", async () => {
  await aluno.pagina.goto(`${SITE}/itens/importar`, { waitUntil: "networkidle" });
  if (new URL(aluno.pagina.url()).pathname !== "/") throw new Error(`ficou em ${aluno.pagina.url()}`);
});
await passo("aluno vê itens e fotos, mas sem botões de cadastro", async () => {
  await aluno.pagina.goto(`${SITE}/itens`, { waitUntil: "networkidle" });
  if (await aluno.pagina.getByRole("button", { name: "Novo item" }).count()) throw new Error("aluno vê 'Novo item'");
  if (await aluno.pagina.getByRole("link", { name: "Importar planilha" }).count()) throw new Error("aluno vê 'Importar planilha'");
  if (!(await aluno.pagina.getByRole("button", { name: "Ler QR" }).count())) throw new Error("aluno sem 'Ler QR'");
});
await passo("aluno não consegue marcar 'Não terá mais' (RLS)", async () => {
  const tkAluno = await token("aluno1@escola.local");
  const itens = await rest(tkAluno, `/rest/v1/itens?codigo=eq.${P}B-001&select=id`);
  const r = await fetch(`${API}/rest/v1/itens?id=eq.${itens[0].id}`, {
    method: "PATCH", headers: { apikey: CHAVE, Authorization: `Bearer ${tkAluno}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ repor: false }),
  });
  const corpo = await r.json();
  if (Array.isArray(corpo) && corpo.length > 0) throw new Error("aluno conseguiu alterar o item");
});
await aluno.contexto.close();
await navegador.close();

console.log(`Arquivos de apoio em: ${PASTA}`);
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n=== RESUMO: ${resultados.length - falhas.length} passaram, ${falhas.length} falharam (prefixo desta execução: ${P}) ===`);
falhas.forEach((f) => console.log(` - ${f.nome}: ${f.extra}`));
writeFileSync(join(PASTA, "resultado.json"), JSON.stringify({ prefixo: P, resultados }, null, 2));
process.exit(falhas.length ? 1 : 0);
