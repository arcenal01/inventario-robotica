import { criarClienteNavegador } from "@/lib/supabase/client";

export const BUCKET_FOTOS = "itens-fotos";
const LADO_MAXIMO = 1024;
const QUALIDADE = 0.82;

/** URL pública da foto. O banco guarda só o caminho no bucket (vale local e na nuvem). */
export function urlFoto(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  return criarClienteNavegador().storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Reduz a foto no próprio aparelho antes de enviar (foto de celular tem 3-8 MB; vira ~150 KB).
 * Respeita a rotação da câmera e sempre gera JPEG.
 */
export async function reduzirFoto(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const largura = Math.round(imagem.width * escala);
  const altura = Math.round(imagem.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste aparelho.");
  ctx.fillStyle = "#ffffff"; // PNG com fundo transparente não fica preto no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();

  return new Promise((resolver, rejeitar) =>
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rejeitar(new Error("Não foi possível converter a imagem."))),
      "image/jpeg",
      QUALIDADE,
    ),
  );
}

/** Envia a foto do item e devolve o caminho para gravar em itens.foto_url. */
export async function enviarFoto(itemId: string, foto: Blob): Promise<string> {
  const caminho = `${itemId}/${Date.now()}.jpg`;
  const { error } = await criarClienteNavegador()
    .storage.from(BUCKET_FOTOS)
    .upload(caminho, foto, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  return caminho;
}

/** Apaga uma foto antiga. Falha aqui não atrapalha o cadastro (só sobra um arquivo no bucket). */
export async function apagarFoto(caminho: string | null | undefined): Promise<void> {
  if (!caminho) return;
  await criarClienteNavegador().storage.from(BUCKET_FOTOS).remove([caminho]);
}
