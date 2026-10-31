"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { normalizarCodigo } from "./codigo-endereco";

/** Por que a câmera não pode abrir aqui (ou null se dá para tentar). */
function motivoSemCamera(): string | null {
  if (!window.isSecureContext) {
    return "A câmera só abre em endereço seguro (https ou localhost). No celular isso chega no Bloco 14; por enquanto, digite o código da etiqueta.";
  }
  if (!navigator.mediaDevices?.getUserMedia) return "Este navegador não permite usar a câmera. Digite o código da etiqueta.";
  return null;
}

function mensagemErroCamera(e: unknown): string {
  const nome = e instanceof DOMException ? e.name : "";
  if (nome === "NotAllowedError") return "Permissão da câmera negada. Libere a câmera nas configurações do navegador ou digite o código.";
  if (nome === "NotFoundError") return "Nenhuma câmera encontrada. Digite o código.";
  if (nome === "NotReadableError") return "A câmera está em uso por outro aplicativo.";
  return "Não foi possível abrir a câmera. Digite o código.";
}

/**
 * Câmera traseira + leitura de QR (biblioteca jsQR, carregada só quando a câmera abre).
 * Analisa ~6 quadros por segundo numa imagem reduzida (máx. 640 px) para não pesar no celular.
 */
export function LeitorQr({ aoLer }: { aoLer: (texto: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aoLerRef = useRef(aoLer);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    aoLerRef.current = aoLer;
  });

  useEffect(() => {
    const motivo = motivoSemCamera();
    if (motivo) {
      setErro(motivo);
      return;
    }
    let parar = false;
    let stream: MediaStream | null = null;
    let quadro = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    void (async () => {
      try {
        const [{ default: jsQR }, midia] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        ]);
        stream = midia;
        const video = videoRef.current;
        if (parar || !video || !ctx) {
          midia.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = midia;
        await video.play();
        setPronto(true);

        let ultimo = 0;
        const ler = (agora: number) => {
          if (parar) return;
          if (agora - ultimo > 150 && video.readyState >= 2 && video.videoWidth > 0) {
            ultimo = agora;
            const escala = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * escala);
            canvas.height = Math.round(video.videoHeight * escala);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "dontInvert" });
            if (qr?.data) {
              parar = true;
              // o navegador só deixa vibrar depois de um toque do usuário na página
              if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(80);
              aoLerRef.current(qr.data);
              return;
            }
          }
          quadro = requestAnimationFrame(ler);
        };
        quadro = requestAnimationFrame(ler);
      } catch (e) {
        if (!parar) setErro(mensagemErroCamera(e));
      }
    })();

    return () => {
      parar = true;
      cancelAnimationFrame(quadro);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (erro) {
    return (
      <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        {erro}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md bg-black">
        <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-lg border-4 border-white/80" />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {pronto ? "Aponte para o QR da etiqueta." : "Abrindo a câmera..."}
      </p>
    </div>
  );
}

/**
 * Campo de código: digitar + OK, ou "Ler QR com a câmera". Devolve o código já normalizado.
 * Quem usa decide o que fazer com ele (ex.: resolverEndereco).
 */
export function CampoCodigo({
  id,
  rotulo,
  exemplo,
  aoConfirmar,
}: {
  id: string;
  rotulo: string;
  exemplo?: string;
  aoConfirmar: (codigo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [semCamera, setSemCamera] = useState<string | null>(null);

  // window só existe no navegador: calcula depois de montar para não divergir do HTML do servidor
  useEffect(() => {
    setSemCamera(motivoSemCamera());
  }, []);

  function confirmar(e: FormEvent) {
    e.preventDefault();
    const codigo = normalizarCodigo(texto);
    if (codigo) aoConfirmar(codigo);
  }

  return (
    <div className="space-y-2">
      <form onSubmit={confirmar}>
        <Campo id={id} rotulo={rotulo}>
          <div className="flex gap-2">
            <Input
              id={id}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={exemplo}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="submit" disabled={!texto.trim()}>
              OK
            </Button>
          </div>
        </Campo>
      </form>
      <Button type="button" variant="outline" className="w-full" disabled={semCamera !== null} onClick={() => setLendo(true)}>
        Ler QR com a câmera
      </Button>
      {semCamera ? <p className="text-xs text-muted-foreground">{semCamera}</p> : null}

      <Dialogo aberto={lendo} titulo="Ler QR Code" aoFechar={() => setLendo(false)}>
        <LeitorQr
          aoLer={(lido) => {
            const codigo = normalizarCodigo(lido);
            setLendo(false);
            setTexto(codigo);
            if (codigo) aoConfirmar(codigo);
          }}
        />
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setLendo(false)}>
            Cancelar
          </Button>
        </div>
      </Dialogo>
    </div>
  );
}
