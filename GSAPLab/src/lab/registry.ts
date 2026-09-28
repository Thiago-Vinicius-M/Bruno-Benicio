/**
 * ============================================================================
 * REGISTRO DE EXEMPLOS
 * ============================================================================
 *
 * A página renderiza os exemplos NESTA ordem, de cima para baixo.
 *
 * Para adicionar o exemplo 11:
 *   1. crie a pasta src/examples/example11-nome/ (copie um exemplo parecido)
 *   2. exporte `example11` no index.ts dela
 *   3. importe aqui e adicione ao final do array
 *
 * A ordem importa para o ScrollTrigger: triggers devem ser criados na ordem
 * em que aparecem na página (principalmente quando há pin), porque um pin
 * empurra tudo o que vem depois. Como o React monta os componentes irmãos em
 * ordem, a ordem deste array = ordem de criação dos ScrollTriggers.
 */
import type { LabExample } from "./types";
import { example01 } from "../examples/example01-fade-slide";
import { example02 } from "../examples/example02-scrub-text";
import { example03 } from "../examples/example03-text-stagger";
import { example04 } from "../examples/example04-image-reveal";
import { example05 } from "../examples/example05-image-parallax";
import { example06 } from "../examples/example06-video-scroll";
import { example07 } from "../examples/example07-video-pin";
import { example08 } from "../examples/example08-cinematic-timeline";
import { example09 } from "../examples/example09-horizontal-pin";
import { example10 } from "../examples/example10-snap-story";

export const EXAMPLES: LabExample[] = [
  example01,
  example02,
  example03,
  example04,
  example05,
  example06,
  example07,
  example08,
  example09,
  example10,
];
