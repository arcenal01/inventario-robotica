import type { MetadataRoute } from "next";

/** Manifest do PWA: permite "Instalar app" / "Adicionar à tela de início" no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventário Robótica",
    short_name: "Robótica",
    description: "Controle de inventário da sala de eletrônica e robótica.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151a26",
    theme_color: "#151a26",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
