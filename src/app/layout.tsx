import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio app (funcionam sem internet)
const fonteTexto = Geist({ subsets: ["latin"], variable: "--fonte-texto" });
const fonteCodigo = Geist_Mono({ subsets: ["latin"], variable: "--fonte-codigo" });

export const metadata: Metadata = {
  title: { default: "Inventário Robótica", template: "%s | Inventário Robótica" },
  description: "Controle de inventário da sala de eletrônica e robótica.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#151a26",
};

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    // "dark" é o padrão; o script abaixo aplica a escolha salva antes de pintar (sem piscar)
    <html lang="pt-BR" className={`dark ${fonteTexto.variable} ${fonteCodigo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
