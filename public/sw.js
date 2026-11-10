// Service worker do Inventário Robótica (Blocos 14 e 15A).
// - Arquivos do app (/_next/static, ícones): guardados no aparelho na primeira visita (cache primeiro).
// - Páginas: busca na rede; sem rede, mostra a última versão guardada ou a página /offline.
// - Dados do Supabase (/supabase/...): sempre pela rede. A cópia dos dados e a fila offline ficam no IndexedDB (Bloco 15A).
// - Mensagem {tipo: "guardar", urls}: o app pede para guardar já as telas usadas offline (e os arquivos delas).
// Ao publicar uma versão nova do app, aumente VERSAO para apagar os caches antigos.

const VERSAO = "v0.15.0";
const ESTATICOS = `estaticos-${VERSAO}`;
const PAGINAS = `paginas-${VERSAO}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(ESTATICOS)
      .then((c) => c.addAll([OFFLINE, "/manifest.webmanifest", "/icones/icone-192.png", "/icones/icone-512.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== ESTATICOS && n !== PAGINAS).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Ao sair do app, apaga as páginas guardadas (podem ter dados da pessoa).
// "guardar": baixa as páginas pedidas (com a sessão da pessoa) e os arquivos /_next/static que elas usam.
self.addEventListener("message", (evento) => {
  if (evento.data === "sair") evento.waitUntil(caches.delete(PAGINAS));
  else if (evento.data?.tipo === "guardar" && Array.isArray(evento.data.urls)) evento.waitUntil(guardarPaginas(evento.data.urls));
});

async function guardarPaginas(urls) {
  const paginas = await caches.open(PAGINAS);
  const estaticos = await caches.open(ESTATICOS);
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) continue; // só telas deste app
    try {
      const resposta = await fetch(url, { credentials: "same-origin" });
      if (!resposta.ok || resposta.redirected) continue;
      const html = await resposta.clone().text();
      await paginas.put(url, resposta);
      const arquivos = new Set(html.match(/\/_next\/static\/[^"'\s\\]+/g) ?? []);
      for (const arquivo of arquivos) {
        if (await estaticos.match(arquivo)) continue;
        const r = await fetch(arquivo);
        if (r.ok) await estaticos.put(arquivo, r);
      }
    } catch {
      // sem conexão: tenta de novo na próxima preparação
    }
  }
}

async function cachePrimeiro(pedido) {
  const guardado = await caches.match(pedido);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok) (await caches.open(ESTATICOS)).put(pedido, resposta.clone());
  return resposta;
}

async function redePrimeiro(pedido) {
  try {
    const resposta = await fetch(pedido);
    // Só guarda páginas de verdade (não redirecionamentos para /entrar, nem erros)
    if (resposta.ok && !resposta.redirected) (await caches.open(PAGINAS)).put(pedido, resposta.clone());
    return resposta;
  } catch {
    return (await caches.match(pedido, { ignoreSearch: true })) ?? (await caches.match(OFFLINE));
  }
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/supabase/")) return; // dados: sempre pela rede

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icones/") || url.pathname === "/manifest.webmanifest") {
    evento.respondWith(cachePrimeiro(pedido));
    return;
  }
  if (pedido.mode === "navigate") {
    evento.respondWith(redePrimeiro(pedido));
  }
});
