import type { Metadata } from "next";
import { Barlow_Condensed, DM_Serif_Display, Manrope } from "next/font/google";
import { AtmosphereBackground } from "@/components/AtmosphereBackground/AtmosphereBackground";
import "./globals.css";

/*
 * Somente os pesos usados pelos tokens de globals.css. next/font hospeda os arquivos junto
 * com o site (sem requisição ao Google), usa font-display: swap e gera uma fonte de fallback
 * com métricas ajustadas, o que evita o texto "pular" quando a fonte termina de carregar.
 */

/** Display: títulos, números editoriais e textos grandes/decorativos. */
const barlowCondensed = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
});

/** Texto: parágrafos, navegação e textos funcionais da interface. */
const manrope = Manrope({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-manrope",
});

/** Editorial: uso restrito a frases de destaque. */
const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif-display",
});

export const metadata: Metadata = {
  title: "Bruno & Benício",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${barlowCondensed.variable} ${manrope.variable} ${dmSerifDisplay.variable}`}
    >
      <body>
        {/* Fixa atrás de todas as páginas; preset e ajustes em components/AtmosphereBackground/atmosphereConfig.ts */}
        <AtmosphereBackground />
        {children}
      </body>
    </html>
  );
}
