import type { QueryClient } from "@tanstack/react-query";
import {
  carregarItensParaContarTodos,
  chaveItensParaContar,
  consultaContagem,
  consultaContagens,
  consultaPosicoes,
  type ItemParaContar,
} from "@/features/contagens/consultas";
import { recebeContagens } from "@/features/contagens/regras";
import { consultaEnderecos, consultaTiposEndereco } from "@/features/enderecos/consultas";
import { carregarTodosSaldos, consultaCategorias, consultaItens, type SaldoEndereco } from "@/features/itens/consultas";

/**
 * Baixa para o aparelho tudo o que a consulta e a contagem offline precisam (com conexão):
 * itens, categorias, endereços, saldos de cada item e, para cada contagem recebendo contagens,
 * as posições e os itens de TODAS as posições. As consultas viram cópias no IndexedDB (dados-offline.tsx).
 * Também pede ao service worker para guardar as páginas dessas telas e carrega o leitor de QR.
 * Devolve true se baixou tudo.
 */
export async function prepararOffline(queryClient: QueryClient): Promise<boolean> {
  try {
    const [itens] = await Promise.all([
      queryClient.fetchQuery(consultaItens),
      queryClient.fetchQuery(consultaCategorias),
      queryClient.fetchQuery(consultaEnderecos),
      queryClient.fetchQuery(consultaTiposEndereco),
    ]);
    const saldos = await carregarTodosSaldos();
    for (const i of itens) queryClient.setQueryData<SaldoEndereco[]>(["saldos", i.id], saldos.get(i.id) ?? []);

    const contagens = await queryClient.fetchQuery({ ...consultaContagens, staleTime: 0 });
    const ativas = contagens.filter((c) => recebeContagens(c.status));
    await Promise.all(
      ativas.map(async (c) => {
        queryClient.setQueryData(consultaContagem(c.id).queryKey, c);
        const [posicoes, porPosicao] = await Promise.all([
          queryClient.fetchQuery({ ...consultaPosicoes(c.id), staleTime: 0 }),
          carregarItensParaContarTodos(c.id),
        ]);
        for (const p of posicoes) {
          queryClient.setQueryData<ItemParaContar[]>(chaveItensParaContar(c.id, p.endereco_id), porPosicao.get(p.endereco_id) ?? []);
        }
      }),
    );

    guardarPaginas(["/", "/itens", "/enderecos", "/contagens", "/pendencias", ...ativas.flatMap((c) => [`/contagens/${c.id}`, `/contagens/${c.id}/contar`])]);
    // o leitor de QR é carregado só ao abrir a câmera: carregar agora deixa o arquivo guardado para uso offline
    void import("jsqr").catch(() => undefined);
    return true;
  } catch {
    return false; // sem conexão ou servidor fora: tenta de novo mais tarde
  }
}

/** Pede ao service worker (só existe no app de produção) para guardar estas páginas e os arquivos delas. */
function guardarPaginas(urls: string[]) {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.active?.postMessage({ tipo: "guardar", urls }))
    .catch(() => undefined);
}
