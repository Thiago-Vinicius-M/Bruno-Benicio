/**
 * Registro dos plugins do GSAP — executado uma única vez, no primeiro import.
 *
 * As animações do site importam `gsap`, `ScrollTrigger` e `useGSAP` deste arquivo,
 * o que garante que os plugins já estejam registrados quando forem usados.
 * O registro não acessa `window`, então é seguro durante a renderização no servidor.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Em celulares a barra de endereço aparece/some durante o scroll e muda a altura da viewport.
// Sem isso, cada mudança recalcularia start/end no meio da rolagem, causando pequenos saltos.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, useGSAP };
