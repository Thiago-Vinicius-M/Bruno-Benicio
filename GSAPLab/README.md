# GSAP Scroll Lab

Laboratório de estudo de animações de scroll com **GSAP 3.15 + ScrollTrigger**, em **React 19 + TypeScript + Vite**.

Uma única página com 10 experimentos. Cada seção isola uma técnica, mostra o código que está rodando e tem um painel para alterar os parâmetros ao vivo.

> 📘 O tutorial completo (conceitos, os 10 exemplos em detalhe, tabela de propriedades e método para criar animações) está em **[docs/TUTORIAL.md](docs/TUTORIAL.md)**.

## Rodando

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + build de produção em dist/
npm run lint      # oxlint
```

## Os 10 exemplos

| #  | Exemplo                       | Elemento       | Técnica principal                                         |
| -- | ----------------------------- | -------------- | --------------------------------------------------------- |
| 01 | Fade + Slide                  | texto          | `gsap.from()` + `toggleActions` (o scroll só dispara)      |
| 02 | Texto Scrubbed                | texto          | `scrub: false / true / número` e o conceito de playhead    |
| 03 | Texto com Stagger             | texto          | `stagger` (`each`, `amount`, `from`) + query de vários alvos |
| 04 | Imagem Reveal / Clip          | imagem         | `clipPath` + `scale` + `transformOrigin` com scrub         |
| 05 | Imagem Parallax               | imagem         | `yPercent` + `overflow: hidden` + matemática da altura      |
| 06 | Vídeo controlado pelo Scroll  | vídeo          | metadata → `duration` → `progress × duration = currentTime` |
| 07 | Vídeo com Pin                 | vídeo + texto  | `pin`, `pinSpacing`, pin-spacer, `onToggle`                |
| 08 | Timeline Cinematic            | texto + imagem | `gsap.timeline()` + position parameter (régua visual)      |
| 09 | Pin + Movimento Horizontal    | imagem + texto | distância medida (`scrollWidth − clientWidth`), end dinâmico |
| 10 | Snap + Scroll Story           | vídeo + imagem + texto | labels + `snap` + `labelToScroll()`                |

## Estrutura

```
src/
├── main.tsx                 ← registra plugins (import "./lib/gsapSetup") e monta o app
├── App.tsx
├── config/
│   └── debug.ts             ← DEBUG_SCROLL (markers de todos os exemplos)
├── lib/
│   ├── gsapSetup.ts         ← gsap.registerPlugin(ScrollTrigger, useGSAP) + ScrollTrigger.config
│   └── media.ts             ← media queries usadas com gsap.matchMedia() (mobile/tablet/desktop/reduceMotion)
├── lab/                     ← "moldura" do laboratório (não anima nada)
│   ├── registry.ts          ← LISTA DE EXEMPLOS (ordem da página)
│   ├── types.ts             ← ExampleMeta, Control (schema do painel)
│   ├── useLabParams.ts      ← estado do painel + ScrollTrigger.sort()/refresh() após mudanças
│   ├── options.ts           ← opções dos selects (eases, toggleActions, scrub)
│   └── useMediaQuery.ts
├── components/              ← UI reutilizável
│   ├── ScrollLab.tsx        ← página: header → exemplos → footer
│   ├── AnimationSection.tsx ← moldura de cada exemplo (título, palco, código, dock)
│   ├── ParameterPanel.tsx   ← controles gerados a partir do schema
│   ├── CodeBlock.tsx, Hud.tsx, LabHeader.tsx, LabFooter.tsx
├── examples/
│   ├── example01-fade-slide/
│   │   ├── animation.ts           ← ★ o código GSAP (estude este arquivo)
│   │   ├── Example01FadeSlide.tsx ← markup + useGSAP + controles do painel
│   │   ├── styles.css             ← CSS estático do exemplo
│   │   └── index.ts               ← metadados (título, conceitos, "o que observar")
│   ├── example02-scrub-text/ … example10-snap-story/   (mesma anatomia)
└── styles/global.css
public/media/                ← imagens (.webp) e vídeos (.mp4) locais
```

### Anatomia de um exemplo

Cada exemplo separa **o que estudar** do **encanamento de UI**:

- **`animation.ts`** — todo o GSAP fica aqui, sem abstrações escondidas: os parâmetros padrão (`*_DEFAULTS`), o `gsap.matchMedia()`, o tween/timeline e o objeto `scrollTrigger` completo, com comentários explicando cada propriedade. A página exibe este arquivo inteiro em "Código-fonte completo" (import `?raw` do Vite).
- **`ExampleXX.tsx`** — refs dos elementos, o `useGSAP` que chama `createXxx(...)` e devolve o cleanup, a lista de controles do painel e o trecho "Configuração atual" gerado a partir dos parâmetros.
- **`styles.css`** — tudo que é estático (layout, `overflow`, `aspect-ratio`...). O que anima fica no `animation.ts`.
- **`index.ts`** — metadados exibidos no topo da seção e no índice.

### Fluxo de uma animação

```
registry.ts → ScrollLab → <Example07VideoPin meta>
  └─ useLabParams(DEFAULTS)                      estado do painel
  └─ useGSAP(() => {                             roda após o DOM existir (useLayoutEffect)
       const mm = createVideoPin(refs, params)   ← animation.ts
       return () => mm.revert()                  cleanup: desfaz tweens, ScrollTriggers, pins
     }, { dependencies: [params, runId], revertOnUpdate: true })
         └─ gsap.matchMedia().add(MEDIA, ctx => {
              if (reduceMotion) return             versão estática
              gsap.timeline({ scrollTrigger: { trigger, pin, start, end, scrub … } })
            })
```

Quando você muda um valor no painel: o `useGSAP` reverte tudo o que aquele exemplo criou → recria com os novos valores → `useLabParams` chama `ScrollTrigger.sort()` + `ScrollTrigger.refresh()` para recalcular as posições de todos os triggers da página (um pin maior empurra tudo o que vem depois).

## Markers (debug)

- `src/config/debug.ts` → `export const DEBUG_SCROLL = false;` — mude para `true` para ligar os markers de **todos** os exemplos.
- Cada painel de parâmetros tem a checkbox **markers**, para ligar só o exemplo que você está estudando (recomendado: com os 10 ligados, ~20 marcadores "scroller-start/end" ficam empilhados na borda da tela).
- Cada ScrollTrigger tem um `id` (`"01-fade-slide"`, `"07-video-pin"`…) que aparece no texto dos markers.

## Adicionando o exemplo 11

1. **Copie** a pasta do exemplo mais parecido, por exemplo `src/examples/example02-scrub-text` → `src/examples/example11-meu-efeito`.
2. **`animation.ts`** — renomeie tipos/função e escreva a animação:

   ```ts
   import { gsap } from "gsap";
   import { DEBUG_SCROLL } from "../../config/debug";
   import { MEDIA, type MediaConditions } from "../../lib/media";

   export type MeuEfeitoParams = { start: string; end: string; scrub: boolean | number; markers: boolean };

   export const MEU_EFEITO_DEFAULTS: MeuEfeitoParams = {
     start: "top 80%",
     end: "bottom 20%",
     scrub: true,
     markers: DEBUG_SCROLL,
   };

   export function createMeuEfeito(el: { trigger: HTMLElement; target: HTMLElement }, params: MeuEfeitoParams) {
     const mm = gsap.matchMedia();
     mm.add(MEDIA, (context) => {
       const { isMobile, reduceMotion } = context.conditions as MediaConditions;
       if (reduceMotion) return;
       gsap.to(el.target, {
         rotation: isMobile ? 90 : 180,
         ease: "none",
         scrollTrigger: { id: "11-meu-efeito", trigger: el.trigger, start: params.start, end: params.end, scrub: params.scrub, markers: params.markers },
       });
     });
     return mm;
   }
   ```

3. **`Example11MeuEfeito.tsx`** — refs + `useGSAP` + controles:

   ```tsx
   export function Example11MeuEfeito({ meta }: ExampleProps) {
     const lab = useLabParams(MEU_EFEITO_DEFAULTS);
     const triggerRef = useRef<HTMLDivElement>(null);
     const targetRef = useRef<HTMLDivElement>(null);

     useGSAP(() => {
       const mm = createMeuEfeito({ trigger: triggerRef.current!, target: targetRef.current! }, lab.params);
       return () => mm.revert();
     }, { dependencies: [lab.params, lab.runId], revertOnUpdate: true });

     return (
       <AnimationSection meta={meta} lab={lab} controls={CONTROLS} snippet={toSnippet(lab.params)} source={source} summary={[["start", lab.params.start]]}>
         <div className="me-stage" ref={triggerRef}><div className="me-box" ref={targetRef} /></div>
       </AnimationSection>
     );
   }
   ```

4. **`index.ts`** — `export const example11: LabExample = { meta: { number: "11", title: "…", … }, Component: Example11MeuEfeito };`
5. **`src/lab/registry.ts`** — importe `example11` e adicione ao **final** do array `EXAMPLES`.

Pronto: o índice, a navegação, o painel e o bloco de código aparecem automaticamente.

## Acessibilidade e performance

- `prefers-reduced-motion: reduce` → cada `animation.ts` tem um ramo `reduceMotion` (sem pin, sem scrub; vídeos ganham controles nativos) e o CSS de cada exemplo tem a versão estática. Teste no DevTools → Rendering → *Emulate CSS media feature prefers-reduced-motion*.
- Animações usam `transform`/`opacity` (e `clip-path`, que não afeta layout). Imagens e vídeos ficam em molduras com `aspect-ratio` (sem layout shift, o que manteria as posições do ScrollTrigger corretas).
- Vídeos: `muted` + `playsInline`, sem `autoplay` — o play/pause é feito por callbacks (`onToggle`, labels) apenas quando o vídeo está visível.

## Mídia e créditos

- Fotos: Unsplash (baixadas via picsum.photos), convertidas para WebP — Licença Unsplash.
- `flower-scrub.mp4`: vídeo CC0 da MDN Web Docs, **recodificado com todos os frames como keyframe** para o scrub responder bem nos dois sentidos:
  `ffmpeg -i flower.mp4 -t 5 -an -c:v libx264 -crf 24 -g 1 -pix_fmt yuv420p -movflags +faststart flower-scrub.mp4`
- `sintel-flight.mp4` / `sintel-dunes.mp4`: trechos de *Sintel* © Blender Foundation — [durian.blender.org](https://durian.blender.org/) — CC BY 3.0 (recortados, sem áudio).
