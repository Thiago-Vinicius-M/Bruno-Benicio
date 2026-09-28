# AtmosphereBackground

Atmosfera de fundo cinematográfica (palco / bar / show): base escura, glow âmbar, glow vinho,
véu de luz, feixes opcionais, poeira/bokeh, vinheta e grain. É montada uma vez no layout, fica
fixa atrás de todas as páginas e cada camada pode ser animada separadamente com GSAP.

> Regra de ouro: o conteúdo é o protagonista. Se você passou a *ver* o fundo antes do
> conteúdo, está forte demais.

---

## A. Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `atmosphereConfig.ts` | **Painel de controle.** Tipos, presets (`subtle`, `cinematic`, `stage`) e o preset padrão. É o único lugar com números. |
| `atmosphereStyle.ts` | Funções puras: converte o config em custom properties `--atm-*`, gera o grain (SVG), a vinheta, os feixes e sorteia as partículas (com seed). |
| `AtmosphereBackground.tsx` | Renderiza as camadas, guarda uma ref por camada e expõe a API para o GSAP (`ref` e `getAtmosphereLayers()`). |
| `AtmosphereBackground.module.css` | Só a estrutura das camadas. Lê as variáveis `--atm-*`; nenhum valor visual fixo. |
| `animations/atmosphereDrift.ts` | Fábrica GSAP de movimento ambiente contínuo (desligada por padrão), no mesmo padrão das outras fábricas de `animations/`. |
| `app/layout.tsx` | Monta `<AtmosphereBackground />` como primeiro filho do `<body>`. |

### Camadas (de trás para frente)

```text
[data-atmosphere]  .root   position: fixed · z-index: -1 · pointer-events: none · contain: strict
├── base                      degradê escuro (centro levemente mais claro)
├── texture                   imagem de superfície (lousa/ardósia), misturada à base (só se texture.enabled)
├── lights  ← opacity = intensidade geral das luzes (GSAP)
│   ├── haze        → .glow   véu de luz aberto no topo (vazamento de refletor)
│   ├── red-glow    → .glow   luz vinho/bordô
│   ├── warm-glow   → .glow   luz âmbar/dourado queimado
│   ├── beams       → .beam×N feixes de luz (só se beams.enabled)
│   └── particles   → span×N  poeira / bokeh (só se particles.enabled)
├── vignette                  escurece as bordas da tela
└── grain                     ruído de filme
```

### O princípio que torna tudo animável

Cada luz tem **dois níveis**:

- **Camada externa** (`warm-glow`, `red-glow`, `particles`…): ocupa a tela inteira e é o **alvo
  público do GSAP**. O CSS não define `transform` nem `opacity` nela — estão livres.
- **Forma interna** (`.glow`, cada partícula): recebe posição, tamanho, cor e opacidade do config.

A opacidade final é a **multiplicação** das duas. Por isso `gsap.to(layers.redGlow, { opacity: 0.5 })`
significa "metade do que está no config", e animar uma camada nunca apaga o visual configurado.
A deriva ambiente (`drift`) anima as formas internas, então ela também não disputa propriedades
com as suas animações de scroll nas camadas externas.

### Por que não há conflito de z-index

A raiz é `position: fixed; z-index: -1`, filha direta do `<body>` (que não cria stacking context).
Ela pinta **depois** do fundo do body e **antes** de todo o conteúdo — mesmo os elementos
posicionados das seções. `pointer-events: none` garante que nunca recebe clique, e
`overflow: hidden` + `contain: strict` garantem que nada dela gera scroll lateral ou afeta o layout.

---

## Uso

```tsx
<AtmosphereBackground />                                   // preset padrão
<AtmosphereBackground preset="stage" />                    // outro preset
<AtmosphereBackground config={{ grain: { opacity: 0.04 } }} /> // ajuste pontual por cima do preset
<AtmosphereBackground scope="container" />                 // cobre só o elemento pai
```

`scope="container"`: o pai precisa de `position: relative` e `isolation: isolate` (senão o
`z-index: -1` manda a atmosfera para trás do fundo do pai).

**Onde mudar o padrão do site inteiro:** `ATMOSPHERE_DEFAULT_PRESET` em `atmosphereConfig.ts`,
ou os valores do preset `cinematic`.

### Unidades

| Propriedade | Unidade |
| --- | --- |
| `x`, `y` | % da tela (0 = esquerda/topo, 100 = direita/base). Pode passar de 0–100 para a fonte ficar fora da tela. |
| `size` | `vmax` (1vmax = 1% do maior lado da tela) — escala com qualquer tela. |
| `opacity`, `strength` | 0–1 |
| cores | hex (`"#c7782e"`) |

---

## Textura (imagem)

```ts
texture: { enabled: true, src: textureImage.src, opacity: 0.5, size: "cover", blendMode: "luminosity" }
```

A imagem vem de um import estático no topo de `atmosphereConfig.ts`. Hoje ela é
`Texturas/web/lousa-1920.webp`, a versão web (1920px, WebP, 196 KB) do original
`Texturas/sergey-kotenev--gWSFS8rrVg-unsplash.jpg` (5,7 MB). A anterior, `concreto-1920.webp`
(de `annie-spratt-…jpg`), continua em `Texturas/web/` — basta trocar o import para voltar.

| Propriedade | Efeito |
| --- | --- |
| `opacity` | **0.25** só insinua o relevo · **0.5** padrão · **0.8+** a parede vira protagonista e o fundo clareia. |
| `blendMode` | `"luminosity"` usa só o relevo e mantém a cor da base (tira o tom azulado da foto) · `"normal"` mantém as cores originais · `"soft-light"` / `"overlay"` realçam de leve sem clarear (quase somem em fundo muito escuro). |
| `size` | `"cover"` = uma imagem cobrindo a tela (cortada conforme a proporção) · `"512px"` = ladrilho repetido (use imagem seamless). |
| `enabled` | `false` remove a camada. |

**Trocar a imagem:** gere uma versão web e troque o import:

```bash
node -e "require('sharp')('Texturas/ORIGINAL.jpg').resize({width:1920}).webp({quality:70}).toFile('Texturas/web/NOME-1920.webp')"
```

```ts
import textureImage from "@/Texturas/web/NOME-1920.webp";
```

---

## B. Grain

**Como é feito:** um SVG de 180×180 px com filtro `feTurbulence` (ruído fractal) dessaturado,
convertido em data-URI e repetido em ladrilho (`atmosphereStyle.ts → grainImage`). É procedural:
nenhum arquivo de imagem, o navegador rasteriza uma única vez e não há custo por frame. Ele fica
**atrás** do conteúdo — texturiza só o fundo, fotos e textos continuam limpos.

```ts
grain: { opacity: 0.032, size: 180, frequency: 0.85 }
```

| Propriedade | Efeito |
| --- | --- |
| `opacity` | Intensidade. **0.02** quase invisível · **0.03** padrão · **0.04** filme perceptível · **> 0.06** começa a parecer "tela suja". |
| `frequency` | Tamanho do grão: **0.6** grosso/analógico · **0.85** filme fino · **1.2** quase pó. |
| `size` | Lado do ladrilho em px. Maior = padrão menos repetitivo (raramente precisa mudar). |

```ts
// mais presente
<AtmosphereBackground config={{ grain: { opacity: 0.045 } }} />
// grão mais grosso, estilo película
<AtmosphereBackground config={{ grain: { opacity: 0.035, frequency: 0.6 } }} />
// desligar
<AtmosphereBackground config={{ grain: { opacity: 0 } }} />
```

Teste de exagero: se você consegue apontar o grão numa área lisa a ~60 cm da tela, está forte.
Em telas OLED e com brilho alto ele aparece mais — teste num celular.

---

## C. Glow

`warmGlow`, `redGlow` e `haze` usam a mesma estrutura (`GlowConfig`): uma elipse com degradê
radial que vai da cor cheia no centro até transparente na borda.

```ts
warmGlow: { color: "#c7782e", x: 90, y: 4,  size: 62, ratio: 1.25, opacity: 0.15, softness: 0.7 },
redGlow:  { color: "#7a1a2c", x: 6,  y: 94, size: 72, ratio: 1.15, opacity: 0.24, softness: 0.75 },
haze:     { color: "#e2b48a", x: 50, y: -10, size: 110, ratio: 2.4, opacity: 0.045, softness: 1 },
```

- **Glow quente** — âmbar/dourado queimado, no canto superior direito, como um refletor fora de quadro.
- **Glow vermelho** — vinho, no canto inferior esquerdo. Cores escuras precisam de opacidade maior
  para aparecer, por isso ele tem `0.24` contra `0.15` do quente. A diagonal entre os dois cria a
  transição de temperatura de cor.
- **Haze** — véu largo e quase invisível no topo, que "acende" levemente a parte de cima da tela.

| Quero… | Altere |
| --- | --- |
| mover a luz | `x`, `y` (ex.: `x: 10, y: 5` = canto superior esquerdo) |
| luz maior/menor | `size` (vmax) — 40 contida · 62 padrão · 90 envolve metade da tela |
| mais forte/fraca | `opacity` — quente: 0.08 sutil · 0.15 padrão · 0.25 forte. Vinho: 0.14 · 0.24 · 0.35 |
| mais difusa | `softness` → 1 (decai por igual até a borda) |
| núcleo mais concentrado | `softness` → 0.3 |
| elipse deitada/em pé | `ratio` (2 = deitada · 0.6 = em pé) |
| trocar a cor | `color`. Âmbar: `#c7782e` · dourado: `#b8893a` · laranja escuro: `#a8521f` · vinho: `#7a1a2c` · bordô: `#5e1424` · magenta escuro: `#6a1640` |

Dica: prefira cores **escuras e pouco saturadas** com opacidade maior a cores vivas com opacidade
baixa — o resultado fica mais "luz" e menos "mancha".

Em telas ≤ 767px, `mobile.glowScale` (0.8) reduz o tamanho de todas as luzes.

---

## D. Vignette

```ts
vignette: { strength: 0.55, center: 35, softness: 0.9 }
```

| Propriedade | Efeito |
| --- | --- |
| `strength` | Escuridão nas bordas (alpha do preto). **0.35** leve · **0.55** padrão · **0.75** pesada. |
| `center` | Raio da área central 100% limpa, em %. Maior = mais tela sem escurecer. |
| `softness` | Comprimento da transição: **1** vai até os cantos (fotográfico) · **0.4** corte curto (parece filtro — evite). |

O degradê tem uma parada intermediária (35% da força a 55% do caminho) para a curva ser suave,
sem aquele "anel" de vinheta digital.

---

## E. Partículas

```ts
particles: {
  enabled: true,
  count: 14,           // total no desktop
  mobileCount: 6,      // quantas continuam visíveis em telas ≤ 767px
  size: [1.5, 16],     // diâmetro em px
  opacity: [0.07, 0.32],
  blur: 0.6,           // 0 = ponto nítido · 1 = só halo
  colors: ["#f0b673", "#e8a05a", "#f5d2a8", "#b8465a"],
  distribution: "edges",
  seed: 7,
}
```

- **Quantidade:** `count` / `mobileCount`. Acima de ~25 começa a parecer "chuva de partículas".
- **Tamanho:** o sorteio é elevado ao cubo — a maioria sai perto do mínimo (poeira) e poucas perto
  do máximo (bokeh). Aumente o máximo para bokehs maiores.
- **Opacidade:** automática por tamanho — as grandes recebem o valor mínimo (bokeh distante) e as
  pequenas o máximo (poeira próxima), com uma pequena variação aleatória.
- **Blur:** feito com o próprio degradê (núcleo → transparente), **sem `filter: blur`** — custo zero,
  inclusive animando.
- **Distribuição:** `"edges"` deixa uma elipse central livre (onde fica o conteúdo) · `"uniform"`
  espalha pela tela toda. `seed` troca o sorteio (qualquer número); a mesma seed gera sempre as
  mesmas posições, no servidor e no navegador.
- **Cores:** cada partícula sorteia uma da lista. Repita uma cor para aumentar a chance dela.
- **Velocidade:** só existe com a deriva ligada — veja `drift` abaixo.

### Movimento ambiente (`drift`)

```ts
drift: { enabled: false, glowDistance: 40, glowDuration: 16, particleDistance: 24, particleDuration: 10, mobileFactor: 0.5 }
```

Ligue com `enabled: true`. As luzes vagam lentamente em direções opostas e as partículas flutuam
(`sine.inOut`, yoyo infinito). Só `transform`, sem repaint. `particleDuration` menor = partículas
mais rápidas; `particleDistance` = quanto sobem. Com `prefers-reduced-motion: reduce` a deriva não é
criada e a atmosfera fica estática.

---

## F. Presets

Os presets ficam em `ATMOSPHERE_PRESETS` (`atmosphereConfig.ts`). `cinematic` é o preset completo;
os outros descrevem só o que muda, com `mergeAtmosphere` (objetos são mesclados, listas trocadas):

```ts
export const ATMOSPHERE_PRESETS = {
  subtle:    mergeAtmosphere(cinematic, { ... }),
  cinematic,
  stage:     mergeAtmosphere(cinematic, { ... }),

  // novo preset:
  noir: mergeAtmosphere(cinematic, {
    base: { center: "#101013", edge: "#060607" },
    warmGlow: { opacity: 0.08 },
    redGlow: { opacity: 0.12 },
    particles: { count: 6 },
  }),
} satisfies Record<string, AtmosphereConfig>;
```

O tipo `AtmospherePresetName` se atualiza sozinho — `<AtmosphereBackground preset="noir" />` já
funciona com autocomplete.

---

## G. GSAP

### Acessando as camadas

A atmosfera global fica no layout (fora da árvore das seções), então dentro de qualquer componente
use `getAtmosphereLayers()` — **dentro de `useGSAP`**, que só roda no navegador:

```tsx
import { getAtmosphereLayers } from "@/components/AtmosphereBackground/AtmosphereBackground";

useGSAP(() => {
  const layers = getAtmosphereLayers();
  if (!layers) return;
  // layers.root · lights · haze · warmGlow · redGlow · beams · particles · vignette · grain
});
```

Para uma atmosfera local (`scope="container"`) dentro de um componente client, use a `ref`:

```tsx
const atmosphereRef = useRef<AtmosphereLayers>(null);
<AtmosphereBackground ref={atmosphereRef} scope="container" />
// atmosphereRef.current!.warmGlow
```

**O que animar onde**

| Alvo | Propriedades |
| --- | --- |
| camadas (`warmGlow`, `redGlow`, `haze`, `beams`, `particles`, `vignette`, `grain`) | `x`, `y`, `xPercent`, `yPercent`, `scale`, `rotation`, `opacity` (multiplica o config: 1 = como configurado) |
| `lights` | `opacity` = intensidade de todas as luzes juntas |
| `root` | custom properties: `--atm-intensity-base`, `--atm-warm-opacity`, `--atm-warm-x`, `--atm-red-size`… (lista completa em `atmosphereVariables`) |

Não anime `opacity` da `root`: ela esconderia a base escura e mostraria o fundo mais claro do body.
Como as camadas ocupam a tela inteira, `xPercent: 10` = 10% da largura da tela.

### 1. Glow quente

```ts
gsap.to(layers.warmGlow, { x: 100, y: -50, duration: 5, ease: "sine.inOut" });
```

### 2. Glow vermelho

```ts
// mais fraco que o config (opacity da camada multiplica o config, máx. 1)
gsap.to(layers.redGlow, { opacity: 0.5, duration: 3 });
// mais FORTE que o config: anime a variável
gsap.to(layers.root, { "--atm-red-opacity": 0.4, duration: 3 });
```

### 3. Partículas

```ts
gsap.to(layers.particles, { y: -30, duration: 8, ease: "none" });          // todas juntas
gsap.to(layers.particles!.children, { y: -20, stagger: 0.2, duration: 4 }); // uma a uma
```

Se a deriva estiver ligada, ela já anima o `transform` de cada partícula: anime o **container**
(`layers.particles`), não os filhos.

### 4. A atmosfera inteira

```ts
gsap.to(layers.lights, { opacity: 0.4, duration: 1.5 });      // apaga as luzes (base, vinheta e grain ficam)
gsap.to([layers.warmGlow, layers.redGlow, layers.haze], { scale: 1.1, duration: 6 });
```

### 5. A intensidade

```ts
gsap.to(layers.root, { "--atm-intensity-base": 1.4, duration: 2 });
```

Vale para glows, haze, feixes e partículas ao mesmo tempo, e o fator do mobile continua sendo
aplicado por cima (`--atm-intensity` = base × fator mobile).

### 6. Posição de uma fonte de luz

```ts
// relativo: desloca a camada inteira
gsap.to(layers.warmGlow, { xPercent: -40, yPercent: 20, duration: 4 });
// absoluto: move o centro da luz para 50% × 20% da tela
gsap.to(layers.root, { "--atm-warm-x": "50%", "--atm-warm-y": "20%", duration: 4 });
```

### 7. ScrollTrigger

Seguindo o padrão do projeto (`gsap.matchMedia` + `MEDIA`, sem animação com reduced motion):

```tsx
import { gsap, useGSAP } from "@/animations/gsap";
import { MEDIA, type MediaConditions } from "@/animations/media";
import { getAtmosphereLayers } from "@/components/AtmosphereBackground/AtmosphereBackground";

// dentro de uma seção (ex.: Videos) — a luz "reage" enquanto a seção atravessa a tela
useGSAP(() => {
  const layers = getAtmosphereLayers();
  if (!layers) return;

  const mm = gsap.matchMedia();
  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return;

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: sectionRef.current, start: "top bottom", end: "bottom top", scrub: 1 },
      })
      .to(layers.warmGlow, { yPercent: 25, xPercent: -10 }, 0)
      .to(layers.redGlow, { opacity: 0.6 }, 0)
      .to(layers.root, { "--atm-intensity-base": 1.25 }, 0);
  });
  return () => mm.revert();
});
```

Boas práticas:

- Duas seções animando a **mesma propriedade da mesma camada** brigam entre si. Para uma
  "jornada de luz" pela página toda, crie **uma** timeline com `trigger: document.body`,
  `start: "top top"`, `end: "bottom bottom"` num único lugar, em vez de uma por seção.
- Quando a animação crescer, extraia para uma fábrica em `animations/` + um arquivo de config na
  seção (como `heroParallax.ts`), o padrão que o projeto já usa.
- Use o config como dependência do `useGSAP` (`{ dependencies: [CONFIG], revertOnUpdate: true }`),
  senão o Fast Refresh não reaplica a animação ao editar valores.

---

## H. Criando novas atmosferas

Receitas partindo do `cinematic` — passe como `config` ou vire um preset:

| Atmosfera | O que alterar |
| --- | --- |
| **Mais escura** | `base: { center: "#101013", edge: "#060607" }`, `vignette.strength: 0.7`, `intensity: 0.8` |
| **Mais quente** | `warmGlow: { opacity: 0.22, size: 75, color: "#b8672a" }`, `redGlow.opacity: 0.14`, `haze.color: "#e8b27a"`, partículas só âmbar |
| **Mais vermelha** | `redGlow: { opacity: 0.34, size: 85, color: "#6e1426" }`, `warmGlow.opacity: 0.09`, adicione `"#b8465a"` duas vezes em `particles.colors` |
| **Elegante/minimalista** | `particles.enabled: false`, `haze.opacity: 0.03`, glows com `softness: 1` e `size` maior, `grain.opacity: 0.025`, `vignette.softness: 1` |
| **Palco intenso** | `preset="stage"` e, a partir dele, `beams.opacity: 0.1`, `drift.enabled: true`, `particles.count: 26` |
| **Quase imperceptível** | `preset="subtle"` ou `intensity: 0.5` + `grain.opacity: 0.02` + `vignette.strength: 0.35` |

Exemplos:

```tsx
// mais quente, só neste uso
<AtmosphereBackground
  config={{
    warmGlow: { opacity: 0.22, size: 75, color: "#b8672a" },
    redGlow: { opacity: 0.14 },
    particles: { colors: ["#f0b673", "#e8a05a"] },
  }}
/>

// tudo mais fraco sem mexer em cada camada
<AtmosphereBackground config={{ intensity: 0.6 }} />
```

Controles de intensidade, do mais amplo ao mais específico:

1. `intensity` — todas as luzes (glows, haze, feixes, partículas).
2. `mobile.intensity` / `mobile.glowScale` — ajustes só no celular.
3. `opacity` de cada camada (`warmGlow.opacity`, `particles.opacity`…).
4. `grain.opacity` e `vignette.strength` — independentes do `intensity`, porque não são luz.

---

## Performance

- ~25 elementos DOM no preset padrão (14 partículas), tudo estático; nenhuma animação contínua por padrão.
- Só degradês CSS e um SVG pequeno; nenhum `filter`, `backdrop-filter` ou `mix-blend-mode`.
- `contain: strict` isola a camada: o scroll da página só recompõe, não repinta a atmosfera.
- Animações devem usar `transform`, `opacity` ou custom properties na raiz (as custom properties
  repintam as camadas que as usam — ok para transições, evite em loops infinitos).
