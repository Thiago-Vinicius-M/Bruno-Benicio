/**
 * Fade + slide em sequência — grupos de elementos surgem (opacidade) subindo alguns px,
 * um grupo depois do outro, quando o trigger entra na tela.
 *
 * Uma gsap.timeline() com UM ScrollTrigger: cada passo é um fromTo com vários alvos e
 * `stagger` (os alvos do grupo começam defasados). O position parameter de cada passo
 * decide quando ele começa em relação ao anterior (">" no fim · "-=0.5" sobrepõe 0.5 ·
 * "<" junto com o anterior).
 *
 * Opcionalmente o passo também parte de uma escala menor (scale) e/ou desfocado (blur).
 * `intensity` multiplica tudo o que é "movimento" (y, blur e o quanto a escala difere de 1):
 * 0.5 = metade do efeito · 1 = como configurado · 0 = só o fade.
 *
 * O estado FINAL é o layout do CSS (visível, y 0, escala 1, sem blur): com
 * prefers-reduced-motion nada é criado e a seção já aparece pronta. O trigger não é
 * animado — só os alvos dentro dele.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type FadeSlideStepParams = {
  /** deslocamento inicial em y, em px (positivo = começa mais abaixo) */
  y: number;
  /** escala inicial (1 = sem escala · 0.96 = começa 4% menor) */
  scale?: number;
  /** desfoque inicial em px (0 = sem blur). Use só em textos/elementos leves. */
  blur?: number;
  /** intervalo entre o início de cada alvo do grupo, em segundos */
  stagger?: number;
  /** duração de cada alvo; sem valor usa a duração padrão */
  duration?: number;
  /** quando o passo começa na timeline (position parameter); sem valor = ">" */
  position?: string;
};

export type FadeSlideStep = FadeSlideStepParams & { targets: HTMLElement[] };

export type FadeSlideParams = {
  /** duração padrão de cada passo, em segundos */
  duration: number;
  ease: string;
  /** multiplicador de y, blur e escala (0 = só fade · 1 = como configurado) */
  intensity: number;
  /** multiplicador extra em telas ≤ 767px */
  mobileFactor: number;
  start: string;
  toggleActions: string;
  markers: boolean;
};

export function createFadeSlide(trigger: HTMLElement, steps: FadeSlideStep[], params: FadeSlideParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // composição final estática (CSS)

    const k = params.intensity * (isMobile ? params.mobileFactor : 1);

    const tl = gsap.timeline({
      defaults: { ease: params.ease, duration: params.duration },
      scrollTrigger: {
        id: "fade-slide",
        trigger,
        start: params.start,
        toggleActions: params.toggleActions,
        markers: params.markers,
      },
    });

    for (const step of steps) {
      if (!step.targets.length) continue;

      const from: gsap.TweenVars = { autoAlpha: 0, y: step.y * k };
      const to: gsap.TweenVars = { autoAlpha: 1, y: 0 };

      const scale = 1 - (1 - (step.scale ?? 1)) * k;
      if (scale !== 1) {
        from.scale = scale;
        to.scale = 1;
      }

      const blur = (step.blur ?? 0) * k;
      if (blur > 0) {
        from.filter = `blur(${blur}px)`;
        to.filter = "blur(0px)";
        to.clearProps = "filter"; // não deixa um filter inútil no elemento depois do efeito
      }

      if (step.stagger !== undefined) to.stagger = step.stagger;
      if (step.duration !== undefined) to.duration = step.duration;

      tl.fromTo(step.targets, from, to, step.position);
    }
  });

  return mm;
}
