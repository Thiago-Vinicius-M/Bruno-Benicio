import type { ParallaxLayer, ParallaxParams } from "@/animations/parallax";

/**
 * Parallax do Hero — todos os valores ajustáveis do efeito ficam aqui.
 *
 * CAMADAS
 *   heroLogo  = fundo  → "down": sobe mais devagar que a página (parece longe)
 *   heroPhoto = frente → "up":   sobe mais rápido que a página (parece perto)
 *   O título anda junto com a página e fica no plano do meio.
 *   A profundidade vem da DIFERENÇA de velocidade entre as camadas, não do valor isolado.
 *
 * intensity
 *   % da altura da PRÓPRIA imagem, percorrido ao longo de todo o trecho start → end.
 *   Em 1920px de largura: logo ≈ 416px de altura (1% ≈ 4px) · foto ≈ 640px (1% ≈ 6px).
 *   Aumentar → mais deslocamento e mais diferença de velocidade. Diminuir → mais discreto.
 *   Testar no logo: 10 sutil · 20 médio · 35 forte.  Na foto: 5 sutil · 10 médio · 18 forte.
 *   Logo descendo + foto subindo = as cabeças cobrem mais o logo conforme a página rola.
 *   A foto sobe em relação ao título (que fica sobre a base dela); a base some num degradê,
 *   então a borda não aparece. Acima de ~20 a foto se afasta demais do título.
 *   (A POSIÇÃO de repouso da foto não fica aqui: --photo-x/-y/-scale em Hero.module.css.)
 *
 * direction
 *   Trocar para a mesma direção nas duas camadas reduz muito a profundidade (as duas
 *   ficam do mesmo lado da página). Inverter (logo "up", foto "down") inverte as camadas:
 *   a foto passa a parecer atrás do logo.
 *
 * mobileFactor
 *   Multiplica as duas intensidades em telas ≤ 767px. 1 = igual ao desktop · 0.6 = 60%
 *   · 0 = sem parallax no celular.
 *
 * scrub
 *   true = as camadas ficam presas à barra de rolagem (resposta imediata).
 *   Número = segundos para "alcançar" o scroll, com suavização: 0.5 leve · 1 macio · 2 flutuante.
 *   Não muda a distância percorrida, só a sensação de atraso/inércia.
 *
 * start / end
 *   Trecho do scroll em que o movimento acontece ("<ponto do Hero> <ponto da tela>").
 *   start "clamp(top bottom)": o Hero já está visível ao abrir a página, então "top bottom"
 *   cairia antes do scroll 0 e as imagens já começariam deslocadas. clamp() prende o início
 *   no scroll 0 — a página abre com as imagens exatamente na posição do design.
 *   end "bottom top": termina quando a base do Hero sai pelo topo da tela.
 *   Trecho menor (ex.: end "center top") → mesma distância em menos scroll = parece mais rápido.
 *
 * markers
 *   true desenha na tela as linhas de start/end para depuração. Manter false em produção.
 */
export const HERO_PARALLAX = {
  heroLogo: { intensity: 20, direction: "down" },
  heroPhoto: { intensity: 10, direction: "up" },
  mobileFactor: 0.6,
  scrub: true,
  start: "clamp(top bottom)",
  end: "bottom top",
  markers: false,
} satisfies ParallaxParams & Record<"heroLogo" | "heroPhoto", ParallaxLayer>;
