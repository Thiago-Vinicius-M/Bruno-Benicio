/**
 * ============================================================================
 * REGISTRO DOS PLUGINS — executado UMA única vez (importado no main.tsx)
 * ============================================================================
 *
 * Por que registrar?
 *  - ScrollTrigger é um plugin. Sem `gsap.registerPlugin(ScrollTrigger)`, a
 *    propriedade `scrollTrigger: {...}` dentro de um tween é ignorada.
 *  - Em builds de produção, bundlers fazem "tree shaking" (removem código que
 *    parece não ser usado). Registrar o plugin garante que ele fique no bundle.
 *  - `useGSAP` também é registrado, como recomenda a doc oficial de React,
 *    para evitar problemas quando existem cópias/versões diferentes do GSAP.
 *
 * Registrar mais de uma vez não quebra nada, mas centralizar aqui deixa claro
 * ONDE isso acontece. Os arquivos de animação importam `gsap` e `ScrollTrigger`
 * diretamente de "gsap" e "gsap/ScrollTrigger", exatamente como na documentação.
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 *       https://gsap.com/resources/React/
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Em celulares, a barra de endereço aparece/some durante o scroll e muda a
 * altura da viewport. Cada mudança dispararia um ScrollTrigger.refresh() no
 * meio da rolagem (recalculando start/end → pequenos "saltos"), o que é pior
 * aqui porque vários exemplos usam window.innerHeight no `end`.
 * ignoreMobileResize: true → ignora esses resizes verticais em dispositivos
 * touch. (Padrão da opção: false.)
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()
 */
ScrollTrigger.config({ ignoreMobileResize: true });
