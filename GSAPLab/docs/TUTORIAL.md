# GSAP Scroll Lab — Tutorial completo

> Para estudar com o projeto aberto ao lado. Cada conceito aponta para o arquivo onde ele aparece no código.
> Versões usadas: **gsap 3.15.0**, **@gsap/react 2.1.2**, React 19, Vite 8, TypeScript 6.

## Sumário

1. [Como estudar com o laboratório](#1-como-estudar-com-o-laboratório)
2. [Resumo da arquitetura](#2-resumo-da-arquitetura)
3. [Fundamentos](#3-fundamentos)
   - 3.1 [Tween, timeline, playhead e progress](#31-tween-timeline-playhead-e-progress)
   - 3.2 [gsap.to() × gsap.from() × gsap.fromTo() × gsap.timeline()](#32-gsapto--gsapfrom--gsapfromto--gsaptimeline)
   - 3.3 [start e end: posição do elemento + posição da viewport](#33-start-e-end-posição-do-elemento--posição-da-viewport)
   - 3.4 [toggleActions](#34-toggleactions)
   - 3.5 [scrub e o playhead](#35-scrub-e-o-playhead)
   - 3.6 [pin, pinSpacing e o pin-spacer](#36-pin-pinspacing-e-o-pin-spacer)
   - 3.7 [Timeline e position parameter](#37-timeline-e-position-parameter)
   - 3.8 [snap](#38-snap)
   - 3.9 [React: useGSAP, cleanup e contextSafe](#39-react-usegsap-cleanup-e-contextsafe)
   - 3.10 [Responsividade e movimento reduzido: gsap.matchMedia()](#310-responsividade-e-movimento-reduzido-gsapmatchmedia)
4. [Os 10 exemplos](#4-os-10-exemplos)
5. [Tabela de experimentação](#5-tabela-de-experimentação)
6. [Como pensar uma animação GSAP (método)](#6-como-pensar-uma-animação-gsap)
7. [Criando uma animação do zero: exemplo 11 passo a passo](#7-criando-uma-animação-do-zero-exemplo-11-passo-a-passo)
8. [Problemas comuns (checklist)](#8-problemas-comuns-checklist)
9. [Referências oficiais](#9-referências-oficiais)

---

## 1. Como estudar com o laboratório

```bash
npm install
npm run dev
```

Cada seção da página tem sempre a mesma anatomia:

1. **Cabeçalho** — número, técnica, conceitos e a lista **"O que observar"**.
2. **Palco** — o elemento animado. Um contorno tracejado com a etiqueta `TRIGGER` mostra qual elemento o ScrollTrigger está medindo. Os **HUDs** (caixinhas escuras) mostram valores ao vivo: `progress`, `currentTime`, `tl.time()`, label atual…
3. **Configuração atual** — o código equivalente ao que está rodando, regenerado quando você mexe no painel.
4. **Código-fonte completo** — o `animation.ts` inteiro do exemplo, comentado.
5. **Dock "Parâmetros"** — barra fixa no rodapé enquanto a seção está visível. Abra, mude um valor, role.

**Roteiro sugerido por exemplo:**

1. Leia o bloco de comentário no topo do `animation.ts` do exemplo.
2. Abra "Parâmetros" e ligue **markers**.
3. Role devagar, para baixo e para cima, olhando o HUD.
4. Mude **um** parâmetro por vez e role de novo.
5. Compare com a "Configuração atual".
6. Edite o `animation.ts` direto no editor — o Vite recarrega e o `useGSAP` desfaz e recria tudo sem duplicar.

> Se seu sistema estiver com "reduzir movimento" ligado, os exemplos entram na versão estática (o cabeçalho avisa). No Chrome/Edge: DevTools → ⋮ → More tools → Rendering → *Emulate CSS media feature prefers-reduced-motion*.

---

## 2. Resumo da arquitetura

```
src/
├── main.tsx              registra plugins (import "./lib/gsapSetup") + StrictMode
├── config/debug.ts       DEBUG_SCROLL
├── lib/gsapSetup.ts      gsap.registerPlugin(ScrollTrigger, useGSAP) + ScrollTrigger.config
├── lib/media.ts          MEDIA = { isMobile, isTablet, isDesktop, reduceMotion }
├── lab/                  moldura do laboratório (não anima nada)
│   ├── registry.ts       ORDEM dos exemplos na página
│   ├── useLabParams.ts   estado do painel + sort()/refresh() após mudanças
│   ├── types.ts          ExampleMeta, schema de controles
│   └── options.ts        eases, toggleActions, scrub (opções dos selects)
├── components/           UI: ScrollLab, AnimationSection, ParameterPanel, CodeBlock, Hud…
└── examples/exampleNN-nome/
    ├── animation.ts      ★ o GSAP: DEFAULTS + createXxx(elementos, params, hooks)
    ├── ExampleNN….tsx    refs + useGSAP + controles + snippet
    ├── styles.css        CSS estático
    └── index.ts          metadados
```

**Decisões e por quê:**

| Decisão | Motivo |
| --- | --- |
| Um `animation.ts` por exemplo, com uma função `createXxx(el, params, hooks)` | O GSAP fica isolado e legível de cima a baixo: parâmetros → matchMedia → tween/timeline → `scrollTrigger: {…}`. Nada de `animateEverything()`: cada propriedade está escrita onde é usada. |
| A função recebe **elementos** (vindos de `useRef`), não seletores globais | Sem `document.querySelector` global; dois exemplos com a mesma classe nunca interferem. Quando há vários alvos, a busca é **com escopo**: `gsap.utils.toArray(".alvo", container)`. |
| A função devolve o `gsap.MatchMedia` | O componente faz `return () => mm.revert()` no cleanup do `useGSAP`. Quem cria, desfaz. |
| `hooks` opcionais (`onProgress`, `onUpdate`…) | Os HUDs da página são atualizados pelos callbacks do ScrollTrigger sem misturar código de UI no código da animação. |
| `gsap.matchMedia()` em todos os exemplos | Configuração diferente em mobile + ramo `reduceMotion` + reversão automática quando a condição muda. |
| `useGSAP(…, { dependencies: [params, runId], revertOnUpdate: true })` | Mudou o painel → reverte tudo daquele exemplo (tweens, ScrollTriggers, pin-spacers, estilos inline) → recria. Zero duplicatas, inclusive no StrictMode e no hot reload. |
| `useLabParams` chama `ScrollTrigger.sort()` + `ScrollTrigger.refresh()` depois de recriar | Um ScrollTrigger recriado vai para o fim da lista interna; `sort()` devolve a ordem da página; `refresh()` recalcula as posições (um pin maior empurra tudo abaixo). Testado: mudar o `end` do exemplo 07 e o 08/10 continuam pinando exatamente no topo. |
| `registry.ts` define a ordem | O React monta irmãos em ordem → ScrollTriggers são criados de cima para baixo, como a documentação pede. |

---

## 3. Fundamentos

### 3.1 Tween, timeline, playhead e progress

- **Tween** — anima propriedades de um ou mais alvos ao longo de um tempo (`duration`), com uma curva (`ease`).
- **Timeline** — um "trilho" que contém tweens (e outras timelines) posicionados no tempo.
- **Playhead** — a agulha que diz em que ponto do tempo a animação está. `progress()` é essa posição normalizada: `0` = início, `1` = fim.
- **ScrollTrigger** — liga a **posição do scroll** a uma animação (ou apenas a callbacks). Ele também tem um `progress`:

```
ScrollTrigger.progress = (scrollAtual − start) / (end − start)      limitado entre 0 e 1
```

Existem só **duas** relações possíveis entre scroll e animação — e escolher entre elas é a primeira decisão de qualquer efeito:

| Relação | Como se configura | O que acontece |
| --- | --- | --- |
| **O scroll DISPARA** | sem `scrub` (usa `toggleActions`) | Ao cruzar o `start`, a animação toca sozinha pela sua `duration`. Exemplos 01 e 03. |
| **O scroll CONTROLA** | `scrub: true` ou `scrub: número` | O `progress` do ScrollTrigger vira o `progress` da animação. Exemplos 02, 04–10. |

### 3.2 gsap.to() × gsap.from() × gsap.fromTo() × gsap.timeline()

```js
gsap.to(el,     { x: 300 });                    // do estado ATUAL  → para x: 300
gsap.from(el,   { x: -300, opacity: 0 });       // DE x: -300 / 0   → para o estado ATUAL (o do CSS)
gsap.fromTo(el, { x: -300 }, { x: 300 });       // DE -300          → PARA 300 (os dois explícitos)

const tl = gsap.timeline({ scrollTrigger: {…} });
tl.to(a, {…}).from(b, {…}).fromTo(c, {…}, {…}); // vários tweens em sequência, UM controle
```

| | Estado inicial | Estado final | Quando usar | No lab |
| --- | --- | --- | --- | --- |
| `to()` | o atual | você define | "vá daqui para lá" | 07, 08, 09 |
| `from()` | você define | o atual (CSS) | entradas: o estado final "de verdade" é o do CSS; se o JS falhar, o conteúdo continua visível | 01, 03, 08 |
| `fromTo()` | você define | você define | quando nenhum dos extremos é o CSS, ou quando o mesmo elemento é animado várias vezes | 02, 04, 05, 06, 07, 10 |
| `timeline()` | — | — | 2+ tweens que precisam andar juntos/em sequência | 04, 07, 08, 09, 10 |

Detalhes que causam bugs:

- `from()` e `fromTo()` têm **`immediateRender: true`** por padrão: o estado inicial é aplicado **no momento da criação**. É por isso que o texto do exemplo 01 não "pisca" visível antes de animar. Efeito colateral: callbacks como `onUpdate` podem disparar *durante* a criação — foi exatamente o bug que o teste do exemplo 02 pegou (o `onUpdate` usava `const tween` antes de ela existir; a correção foi usar `this`, que nos callbacks do GSAP é a própria animação).
- Em `fromTo()`, propriedades especiais (`duration`, `ease`, `scrollTrigger`, `stagger`, callbacks) vão **no segundo objeto** (`toVars`).
- `to()` lê o valor inicial quando começa a tocar (em timelines, quando o playhead chega nele). Por isso duas `to()` na mesma propriedade em sequência funcionam (exemplo 08, passos 3 e 6 no `scale` da imagem).

### 3.3 start e end: posição do elemento + posição da viewport

`start` e `end` **não são posições na página**. São a descrição de um **encontro**:

```
start: "<ponto no TRIGGER>  <linha na VIEWPORT>"
```

- **1ª palavra — ponto no elemento trigger:** `top` · `center` · `bottom` · `"20%"` (20% da altura do elemento, a partir do topo dele) · `"100px"` (100px abaixo do topo dele).
- **2ª palavra — linha na viewport (tela):** `top` = 0% · `center` = 50% · `bottom` = 100% · `"80%"` · `"100px"` (medidos a partir do topo da tela).

O `start` acontece **no scroll em que o ponto do elemento encosta na linha da tela**. Os markers desenham exatamente isso: `start`/`end` ficam presos ao elemento (e sobem com ele), `scroller-start`/`scroller-end` ficam fixos na tela. Quando um encosta no outro, o evento acontece.

Régua da viewport usada nos desenhos abaixo:

```
┌──────────────────────────┐  0%    top
│                          │
│                          │  50%   center
│                          │
│                          │  80%
└──────────────────────────┘  100%  bottom
```

#### `start: "top bottom"` — "assim que o elemento aparecer"

```
┌──────────────────────────┐  0%
│                          │
│                          │
│                          │
└──────────────────────────┘  100%  ◄─ linha da viewport: bottom
   ┌──────────────────┐ ◄──────────── ponto do trigger: top  →  START
   │     trigger      │
```

O topo do elemento encosta na base da tela = o primeiro pixel dele acabou de aparecer. É o padrão do ScrollTrigger (quando não há `pin`). Bom para parallax e scrubs que devem durar todo o tempo em que o elemento está visível (exemplos 02 e 05).

#### `start: "top center"` — "quando chegar no meio da tela"

```
┌──────────────────────────┐  0%
│                          │
│  ┌──────────────────┐ ◄──┼── 50%: o topo do trigger chegou ao centro  →  START
│  │     trigger      │    │
└──┼──────────────────┼────┘  100%
   │                  │
```

O elemento já está visível há meia tela de scroll. Usado quando você quer que o usuário "chegue" no elemento antes de algo acontecer.

#### `start: "top 80%"` — o clássico das entradas

```
┌──────────────────────────┐  0%
│                          │
│                          │
│  ┌──────────────────┐ ◄──┼── 80%: o topo do trigger chegou aqui  →  START
│  │     trigger      │    │
└──┼──────────────────┼────┘  100%
```

O elemento já aparece um pouquinho (20% da tela) e aí anima — o usuário vê a animação acontecer, em vez de ela terminar antes de o elemento estar na tela. Exemplo 01.

#### `start: "center center"`

```
┌──────────────────────────┐  0%
│  ┌──────────────────┐    │
│  │     trigger      │    │
│  │ ─ ─ ─ centro ─ ─ │ ◄──┼── 50%: centro do trigger no centro da tela  →  START
│  │                  │    │
│  └──────────────────┘    │
└──────────────────────────┘  100%
```

Útil quando o elemento é mais baixo que a tela e o efeito deve acontecer com ele centralizado.

#### `end: "bottom top"` — "quando o elemento sair por cima"

```
   ┌──────────────────┐
   │     trigger      │
   └──────────────────┘ ◄───────────── ponto do trigger: bottom
┌──────────────────────────┐  0%  ◄─── linha da viewport: top  →  END
│                          │
│                          │
└──────────────────────────┘  100%
```

A base do elemento encostou no topo da tela = o último pixel dele acabou de sair. É o `end` padrão. `"top bottom"` → `"bottom top"` cobre **todo** o tempo em que o elemento é visível.

#### `end: "+=500"` e `end: "+=1000"` — distância, não encontro

`+=` torna o `end` **relativo ao `start`**: "o end fica 500px de scroll depois do start". Não depende de onde está o fundo do elemento.

```
posição do scroll ─────────────────────────────────────────────────►
                 START                    END (+=500)
                   │◄────── 500px ─────────►│
                   │◄────────────── 1000px ─────────────────►│ END (+=1000)
```

- Com **scrub**, a animação inteira é espremida entre start e end: `+=1000` faz a mesma animação andar na metade da velocidade de `+=500` (precisa do dobro de scroll).
- Com **pin**, é quanto tempo (em pixels de scroll) o elemento fica preso. Exemplos 07–10 usam `+=` com uma **função**: `end: () => "+=" + window.innerHeight * 3` (três alturas de tela, recalculado a cada resize).

#### A conta por trás (para nunca mais decorar)

O ScrollTrigger converte a string em um número de pixels de scroll:

```
posição de scroll = (posição do ponto do trigger na PÁGINA) − (posição da linha na VIEWPORT)
```

Exemplo: tela com 900px de altura; o trigger começa a 2000px do topo da página e tem 600px de altura.

| String | Ponto no trigger (página) | Linha na viewport | Dispara com `scrollY` = |
| --- | --- | --- | --- |
| `start: "top bottom"` | 2000 | 900 (100%) | 2000 − 900 = **1100** |
| `start: "top 80%"` | 2000 | 720 (80%) | 2000 − 720 = **1280** |
| `start: "top center"` | 2000 | 450 (50%) | 2000 − 450 = **1550** |
| `start: "center center"` | 2300 | 450 | 2300 − 450 = **1850** |
| `end: "bottom top"` | 2600 | 0 | 2600 − 0 = **2600** |
| `end: "+=500"` (com start "top 80%") | — | — | 1280 + 500 = **1780** |

Com `start: "top 80%"` e `end: "bottom top"`, a animação usa 2600 − 1280 = **1320px** de scroll. Com scrub, rolar 132px = avançar 10% da animação.

Outras formas aceitas (todas documentadas):

- deslocamentos: `"top bottom-=100px"` (100px acima da base da tela);
- número puro: `start: 500` = exatamente `scrollY` 500;
- função: `end: () => "+=" + el.offsetWidth` — reavaliada em todo `refresh()`;
- `endTrigger`: medir o `end` em **outro** elemento;
- `"clamp(top bottom)"`: impede que o start fique antes do scroll 0 (evita o "pulo" de scrubs de elementos que já estão na primeira tela);
- `end: "max"`: o máximo scroll da página.

### 3.4 toggleActions

Sem scrub, o ScrollTrigger vira um "controle remoto" com 4 botões. A string tem **4 posições**, sempre nesta ordem:

```
toggleActions: "onEnter   onLeave   onEnterBack   onLeaveBack"
                   │         │           │              │
   desceu e cruzou │         │           │              │ subiu e cruzou
          o start ─┘         │           │              └─ o start (saiu por cima… do start)
             desceu e cruzou o end       subiu e cruzou o end (voltou para dentro)
```

Ações possíveis: `play`, `pause`, `resume`, `reset`, `restart`, `complete`, `reverse`, `none`. Padrão: `"play none none none"`.

| Valor | Comportamento |
| --- | --- |
| `"play none none none"` | toca uma vez e fica (entradas "one-shot") |
| `"play none none reverse"` | toca ao entrar; desfaz se você voltar acima do start (padrão do exemplo 01) |
| `"play reverse play reverse"` | anima ao entrar/sair nos dois sentidos |
| `"restart none none reset"` | reinicia toda vez que entra; reseta (invisível) ao voltar acima |
| `"play pause resume reset"` | pausa ao sair pelo end, retoma ao voltar |

- O log do exemplo 01 mostra qual callback disparou e qual ação ele executou.
- `once: true` mata o ScrollTrigger depois do primeiro `onEnter` (e força `"play none none none"`).
- Com `scrub`, `toggleActions` não se aplica: quem manda no playhead é a barra de rolagem.

### 3.5 scrub e o playhead

```
                          start                          end
barra de rolagem:  ─────────┼──────────█───────────────────┼──────   (você está em 40%)

sem scrub           playhead anda sozinho pela duration assim que o start é cruzado
scrub: true         playhead = 40% IMEDIATAMENTE (a cada frame, sem atraso)
scrub: 0.5          playhead vai de onde estava até 40% levando 0.5s
scrub: 1            … levando 1s
scrub: 3            … levando 3s (sensação de "peso"/inércia forte)
```

- **Sem scrub** — o scroll só dispara (3.4). A `duration` e a `ease` definem o movimento. Rolar rápido ou devagar não muda nada depois do disparo.
- **`scrub: true`** — vínculo direto. Parou de rolar, parou a animação. Voltou, ela volta. Resposta "seca": cada tranco da roda do mouse aparece na animação.
- **`scrub: número`** — o número são **segundos que o playhead leva para alcançar** a posição do scroll. Suaviza os trancos e dá inércia; cobra em precisão (a animação continua andando um pouco depois que você para). No exemplo 02 as duas barras do HUD mostram isso: `ScrollTrigger.progress` (onde o scroll está) × `tween.progress()` (onde o playhead está).

Consequências práticas:

- **`duration` com scrub vira proporção.** Um tween sozinho com scrub é esticado entre start e end, então `duration: 1` ou `duration: 10` dá no mesmo. Em timelines, as durations dizem quanto do scroll cada passo ocupa (3.7). Para deixar mais longo, **aumente a distância** (`end: "+=2000"`), não a duration.
- **`ease: "none"` é o normal com scrub**: 10% de scroll = 10% de movimento. Outras eases deixam a relação não linear (o exemplo 02 deixa você testar).
- **Callbacks:** o `onUpdate` do **ScrollTrigger** dispara quando o *scroll* muda; o `onUpdate` do **tween/timeline** dispara quando o *playhead* renderiza — inclusive durante o "alcançamento" do scrub numérico, depois que o scroll parou. Para ler o estado visual da animação (ex.: `tl.currentLabel()`), use o callback da animação. O exemplo 10 tinha exatamente esse bug no rascunho: o HUD ficava preso em `"video"` enquanto a tela já mostrava `"final"`.

### 3.6 pin, pinSpacing e o pin-spacer

`pin: true` fixa o **trigger** na tela entre `start` e `end` (aplica `position: fixed` nele). `pin` também aceita outro elemento/seletor. Com `pin`, o `start` padrão vira `"top top"`.

O problema que o pin cria: um elemento `fixed` sai do fluxo e o conteúdo de baixo subiria para o lugar dele. A solução do ScrollTrigger é **envolver o elemento num `<div class="pin-spacer">`**:

```
                pinSpacing: true (padrão)               pinSpacing: false
┌─────────── .pin-spacer ───────────┐        ┌─────────── .pin-spacer ───────────┐
│ ┌──── elemento pinado ─────────┐  │        │ ┌──── elemento pinado ─────────┐  │
│ │ altura original (ex.: 100vh) │  │        │ │ altura original              │  │
│ └──────────────────────────────┘  │        │ └──────────────────────────────┘  │
│  padding-bottom = end − start     │        └───────────────────────────────────┘
│  (ex.: 3 telas = 2700px)          │         conteúdo seguinte vem logo depois
└───────────────────────────────────┘         e passa POR CIMA do pinado
 conteúdo seguinte só aparece aqui
```

- **`pinSpacing: true`** — o pin-spacer ganha `padding-bottom` igual à duração do pin. A seção "ocupa" o tempo do pin na página: o documento fica mais alto exatamente nessa medida (no exemplo 07, com 3 telas de 900px: pin-spacer = 900 + 2700 = 3600px — medido no teste).
- **`pinSpacing: false`** — sem padding: o próximo conteúdo sobe normalmente e cobre o pinado (efeito "cartas empilhadas"). Desligue no painel do exemplo 07.
- **`pinSpacing: "margin"`** — usa margin em vez de padding.
- Se o **pai** do elemento pinado for `display: flex`, o padrão vira `false`.

**Problemas comuns com pin** (a maioria está na página oficial *ScrollTrigger tips & mistakes*):

1. **Animar o próprio elemento pinado.** O ScrollTrigger *mede* o elemento pinado para criar o pin-spacer e fixar largura/altura/posição. Se esse elemento estiver com `scale`, `y` etc. no momento da medição (refresh, resize), as medidas saem erradas → saltos ao pinar/soltar e start/end errados em tudo abaixo. **Pine o container e anime filhos.** Todos os exemplos 07–10 seguem isso (`.vp-section` pinada, `.vp-media` animada).
2. **`transform`, `filter` ou `will-change: transform` em um ANCESTRAL do pinado.** Isso cria um novo "containing block" e `position: fixed` passa a ser relativo a esse ancestral (o elemento "some" ou anda junto). Por isso o `global.css` evita essas propriedades em `main`/`section`. (`pinReparent: true` é a saída de emergência, com custo.)
3. **ScrollTriggers criados fora de ordem.** Um pin empurra tudo abaixo; os triggers devem ser criados de cima para baixo (ou use `refreshPriority` / `ScrollTrigger.sort()`).
4. **Conteúdo que muda de altura depois** (imagens sem dimensão, fontes, dados carregados): chame `ScrollTrigger.refresh()` (este projeto faz isso após `document.fonts.ready`; imagens e vídeos têm `aspect-ratio`).
5. **`scroll-behavior: smooth` no `html`** atrapalha o refresh. Não use.
6. **Tranco ao chegar rápido no pin** → `anticipatePin: 1`.
7. **React sem cleanup** → pin-spacers duplicados/órfãos. O `useGSAP` resolve (3.9).
8. **`100vh` no celular** muda com a barra de endereço → use `100svh` no CSS e `ScrollTrigger.config({ ignoreMobileResize: true })` (este projeto faz os dois).
9. **Triggers dentro de um elemento pinado** precisam de `pinnedContainer` para calcular posições.

### 3.7 Timeline e position parameter

Por que timeline? Imagine seis tweens com delays manuais: mudar a duração do 2º obrigaria a recalcular o delay de todos os seguintes, e cada um precisaria do próprio ScrollTrigger. Numa timeline, os tweens são posicionados **uns em relação aos outros**, e **um único** ScrollTrigger controla o conjunto.

```js
const tl = gsap.timeline({
  defaults: { ease: "power2.inOut", duration: 1 },   // herdado por todos os filhos
  scrollTrigger: { trigger, pin: true, start: "top top", end: "+=3000", scrub: 1 },
});
```

O **position parameter** é o último argumento de `tl.to()/from()/fromTo()/add()/addLabel()`:

| Valor | Significado |
| --- | --- |
| *(omitido)* | no **fim da timeline** (equivale a `"+=0"`) — um depois do outro |
| `">"` | no fim do tween **adicionado por último** |
| `"<"` | no **início** do tween adicionado por último (juntos) |
| `"+=1"` | 1s **depois** do fim da timeline (pausa) |
| `"-=0.5"` | 0.5s **antes** do fim da timeline (sobreposição) |
| `"<0.5"` | 0.5s depois do início do anterior |
| `">-0.25"` | 0.25s antes do fim do anterior |
| `2` | exatamente no segundo 2 (absoluto) |
| `"rotulo"` / `"rotulo+=0.5"` | num label (e deslocado dele) |
| `"-=25%"` / `"<25%"` | porcentagens da duração (do tween inserido / do anterior) |

Exercício (faça as contas antes de ler a resposta):

```js
tl.to(a, { duration: 1 })           // A: 0   → 1
  .to(b, { duration: 1 }, "<")      // B: 0   → 1     (início de A)
  .to(c, { duration: 1 }, "-=0.5")  // C: 0.5 → 1.5   (fim da timeline era 1)
  .to(d, { duration: 1 }, "+=1")    // D: 2.5 → 3.5   (fim era 1.5, +1 de pausa)
  .to(e, { duration: 1 }, ">")      // E: 3.5 → 4.5   (fim de D)
```

`">"` × *omitido* — só diferem quando o último tween adicionado **não** é o que termina por último:

```js
tl.to(a, { duration: 3 })           // 0 → 3
  .to(b, { duration: 1 }, "<")      // 0 → 1
  .to(c, { duration: 1 }, ">")      // 1 → 2   fim de B (o último adicionado)
  .to(d, { duration: 1 })           // 3 → 4   fim da TIMELINE (que é o fim de A)
```

**Duração relativa com scrub:** a timeline do exemplo 08 tem 5,8s; com `end: "+=" + innerHeight * 4` numa tela de 900px (3600px), cada "segundo" de timeline vale ~620px de scroll. Um tween de `duration: 1.5` ocupa ~930px.

**Sobreposição boa × ruim:** sobrepor tweens de **propriedades/elementos diferentes** é o que dá fluidez (a imagem cresce enquanto o texto sobe — passos 3 e 4 do exemplo 08). Sobrepor dois tweens da **mesma propriedade no mesmo elemento** gera conflito (os dois escrevem `scale` no mesmo frame e o resultado "pula"). Teste no exemplo 08 colocando o passo 6 em `"<"`.

**Não coloque `scrollTrigger` em tweens *dentro* de uma timeline.** A timeline controla o playhead dos filhos; um ScrollTrigger no filho tentaria controlar o mesmo playhead. Um ScrollTrigger por timeline, na própria timeline.

### 3.8 snap

Snap faz o **progress** do ScrollTrigger se encaixar em valores específicos **depois que o usuário para de rolar**. Não bloqueia a roda do mouse (não é scroll-jacking): se você voltar a rolar durante o encaixe, ele desiste (`onInterrupt`).

| Forma | Encaixa em |
| --- | --- |
| `snap: 0.25` | múltiplos de 25%: 0, 0.25, 0.5, 0.75, 1 |
| `snap: [0, 0.2, 0.7, 1]` | só nesses valores |
| `snap: "labels"` | no progress de cada label da timeline |
| `snap: (valor) => …` | na regra que você escrever (ex.: `gsap.utils.snap([...], valor)`) |
| `snap: { snapTo, duration, delay, ease, directional, inertia, onStart, onInterrupt, onComplete }` | forma completa |

- `duration: { min: 0.2, max: 0.8 }` — a duração do encaixe se adapta à distância/velocidade.
- `delay` — espera após o scroll parar.
- `directional` (padrão `true`) — prefere o próximo ponto **na direção** em que você rolava.
- `inertia` — considera a velocidade do scroll para prever onde você pararia (desligue com `false`). No teste automatizado, um scroll rápido até 42% encaixou no **último** momento por causa disso.

**Com labels:** `tl.addLabel("video")` marca um tempo; o ScrollTrigger converte cada label em `tempo ÷ duração total` e usa esses progressos como pontos de snap. Se você mudar durações, os pontos acompanham sozinhos. `st.labelToScroll("video")` converte um label em posição de scroll em pixels (usado pelos botões do exemplo 10).

**Quando usar:** histórias em etapas, slides pinados, carrosséis com conteúdo curto.
**Quando não usar:** texto longo para ler (o snap puxa o conteúdo); distâncias grandes entre pontos (o encaixe vira um salto); junto com CSS `scroll-snap` no mesmo container; muitos pontos seguidos (página "grudenta").

### 3.9 React: useGSAP, cleanup e contextSafe

O hook oficial `useGSAP()` (pacote `@gsap/react`) substitui `useEffect/useLayoutEffect` para animações:

```tsx
const containerRef = useRef<HTMLDivElement>(null);

useGSAP(
  (context, contextSafe) => {
    // tudo o que for criado aqui (tweens, timelines, ScrollTriggers,
    // matchMedia, gsap.set) é registrado num gsap.context()…
    const mm = createMinhaAnimacao(containerRef.current!, params);
    return () => mm.revert(); // …e esta função roda junto do revert
  },
  { scope: containerRef, dependencies: [params], revertOnUpdate: true },
);
```

- Roda em `useLayoutEffect` (o DOM já existe, antes da pintura).
- No desmontar, **reverte tudo**: mata ScrollTriggers, remove pin-spacers, devolve os estilos inline originais.
- `dependencies` + `revertOnUpdate: true`: quando as dependências mudam, reverte e roda de novo (é o que o painel usa).
- `scope`: seletores em texto dentro do hook só enxergam descendentes do container.
- **StrictMode** monta → desmonta → monta os efeitos em desenvolvimento. Sem cleanup, você teria ScrollTriggers e markers duplicados. O teste do projeto conta markers e pin-spacers e confirma: exatamente um por exemplo.
- **`contextSafe`**: animações criadas *depois* que o hook terminou (clique, `setTimeout`, evento `loadedmetadata`) não são registradas no contexto. Envolva a função com `contextSafe(...)`. O exemplo 06 faz isso porque só cria a animação quando o metadata do vídeo chega.
- **Refs em vez de seletores globais**: cada `animation.ts` recebe elementos (`ref.current`). Para vários alvos, busca com escopo: `gsap.utils.toArray(".js-stagger-target", container)`.
- **Estado do React × DOM por frame**: nada de `setState` a cada `onUpdate`. Os HUDs escrevem direto no DOM via ref (`Hud.tsx`). `setState` só para coisas que mudam raramente (label atual, log de callbacks).

### 3.10 Responsividade e movimento reduzido: gsap.matchMedia()

```ts
export const MEDIA = {
  isMobile: "(max-width: 767px)",
  isTablet: "(min-width: 768px) and (max-width: 1023px)",
  isDesktop: "(min-width: 1024px)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
};

const mm = gsap.matchMedia();
mm.add(MEDIA, (context) => {
  const { isMobile, reduceMotion } = context.conditions as MediaConditions;
  if (reduceMotion) return;                         // versão sem movimento
  gsap.to(el, { x: isMobile ? 100 : 300, scrollTrigger: {…} });
  return () => { /* limpeza extra (listeners, atributos) */ };
});
```

- A função roda quando **qualquer** condição bate e roda **de novo** quando **qualquer** uma muda (ex.: você redimensiona de 1200px para 600px). Antes de rodar de novo, tudo o que foi criado nela é **revertido automaticamente**.
- `ScrollTrigger.matchMedia()` está **depreciado**; use `gsap.matchMedia()`.
- Nem toda diferença precisa de matchMedia: se os valores são percentuais ou **medidos** (exemplo 09), o `refresh()` automático no resize já resolve. Use matchMedia quando a **configuração** muda (distância menor, sem pin, outra estratégia).

O que cada exemplo faz em telas pequenas e com movimento reduzido:

| Ex. | Mobile | `prefers-reduced-motion: reduce` |
| --- | --- | --- |
| 01 | `y` × 0.6 (100px pesam mais numa tela de 390px) | sem tween; conteúdo no estado do CSS |
| 02 | distância × 0.5 | texto parado |
| 03 | rotação ÷ 2 (frase quebra em linhas) | frase estática |
| 04 | nada no JS; CSS muda a moldura para 4/5 | imagem inteira |
| 05 | intensidade × 0.6 (menos enjoo, menos ampliação) | imagem parada |
| 06 | layout empilhado; mesmo mapeamento | sem vínculo; `video.controls = true` |
| 07 | escala inicial ≥ 0.85 | sem pin; vídeo com controles; legendas empilhadas |
| 08 | posições/escala do texto e da imagem próprias | composição estática |
| 09 | cards 84vw; distância **medida** se adapta | sem pin; carrossel nativo com `scroll-snap` |
| 10 | pontos de navegação no topo | sem pin/snap; momentos empilhados |

---

## 4. Os 10 exemplos

Formato de cada exemplo: **o que faz** (1) → **conceito** (2) → **como o ScrollTrigger funciona aqui** (3) → **ficha técnica** (4–9: trigger, start, end, scrub, pin, timeline) → **propriedades** (10) → **valores para alterar e efeito** (11–12) → **variações** (13) → **problemas comuns** (14) → **projeto real** (15).

---

### Exemplo 01 — Fade + Slide

📄 `src/examples/example01-fade-slide/animation.ts`

**1. O que faz.** O bloco de texto começa 100px abaixo e invisível. Quando o topo do bloco tracejado cruza a linha de 80% da tela, ele sobe e aparece em 1s. Rolando de volta para cima do start, a animação reverte.

**2. Conceito principal.** O scroll **dispara** a animação, mas não a controla. Depois do disparo, quem manda é a `duration` e a `ease`.

**3. Como o ScrollTrigger funciona aqui.** Um tween `gsap.from()` recebe um objeto `scrollTrigger`. O ScrollTrigger não mexe no playhead continuamente: ele só executa as ações do `toggleActions` quando o scroll cruza `start` ou `end`. Os 4 callbacks alimentam o log da página.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.fs-trigger` — o bloco tracejado, que **não** anima. O alvo é o filho `.fs-content`. Se o trigger fosse o próprio elemento deslocado 100px, o ScrollTrigger mediria a posição "errada". |
| **5. start** | `"top 80%"` — topo do bloco encosta a 80% da altura da tela. |
| **6. end** | `"bottom 20%"` — base do bloco encosta a 20% da tela. **Sem scrub, o end não define duração**; ele só marca onde disparam `onLeave` (descendo) e `onEnterBack` (subindo). |
| **7. scrub** | não usa. |
| **8. pin** | não usa. |
| **9. timeline** | não usa (um tween só). |

**10. Propriedades usadas.**

```ts
gsap.from(content, {
  y: 100,              // deslocamento inicial em px (transform: translateY) — mobile: 60
  opacity: 0,          // opacidade inicial
  duration: 1,         // segundos que a animação leva depois de disparada
  ease: "power2.out",  // rápido no começo, desacelera no fim
  scrollTrigger: {
    id: "01-fade-slide",                      // aparece nos markers
    trigger: block,
    start: "top 80%",
    end: "bottom 20%",
    toggleActions: "play none none reverse",  // onEnter onLeave onEnterBack onLeaveBack
    markers: false,
    onEnter, onLeave, onEnterBack, onLeaveBack, // callbacks → log da página
  },
});
```

**11–12. O que alterar e o que acontece.**

| Parâmetro | Padrão | Experimente | Efeito |
| --- | --- | --- | --- |
| `y` | 100 | 0 / 300 | 0 = só fade; 300 = entrada longa e dramática |
| `duration` | 1 | 0.3 / 2.5 | rápido e seco / lento e suave. **Velocidade média = y ÷ duration** (100px/s → 400px/s com y 200 e duration 0.5) |
| `ease` | power2.out | back.out(1.7), elastic.out(1, 0.4), none | "passa do ponto e volta" / "mola" / velocidade constante (robótico) |
| `start` | top 80% | top bottom / top center | dispara no primeiro pixel visível (boa parte da animação acontece com o bloco ainda colado na base da tela) / dispara só quando o bloco chega no meio da tela |
| `end` | bottom 20% | bottom top | `onLeave` só acontece quando o bloco sai inteiro |
| `toggleActions` | play none none reverse | play none none none / play reverse play reverse / restart none none reset | toca 1 vez / some ao sair nos dois sentidos / reinicia sempre |

**13. Variações.**

```ts
// a) Uma vez só, com autoAlpha (opacity + visibility: hidden quando 0)
gsap.from(el, { autoAlpha: 0, y: 40, duration: 0.8, scrollTrigger: { trigger: el, start: "top 85%", once: true } });

// b) Vários blocos, cada um com o SEU trigger (erro comum: um trigger para todos)
gsap.utils.toArray<HTMLElement>(".card", container).forEach((card) => {
  gsap.from(card, { y: 60, opacity: 0, scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none reverse" } });
});

// c) Grades grandes: ScrollTrigger.batch agrupa quem entra junto e aplica stagger
gsap.set(".card", { y: 60, opacity: 0 });
ScrollTrigger.batch(".card", {
  start: "top 85%",
  onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, stagger: 0.1 }),
});

// d) Entrando pela lateral
gsap.from(el, { x: -80, opacity: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 80%" } });
```

**14. Problemas comuns.**
- **"Pisca" antes de animar:** acontece quando o estado inicial é aplicado tarde. `from()` já aplica na criação (`immediateRender`); crie as animações no `useGSAP` (antes da pintura).
- **Um tween/trigger para vários elementos:** todos animam juntos quando o primeiro entra. Um trigger por elemento, ou `batch`.
- **Elemento com `opacity: 0` ainda clicável:** use `autoAlpha`.
- **Distâncias grandes no mobile:** 100px numa tela de 390px é 1/4 da largura. Por isso o `* 0.6`.
- **Animar o trigger:** a posição medida muda. Anime um filho.

**15. Num projeto real.** Títulos de seção, cards, depoimentos, formulários. Use distâncias pequenas (20–60px), `once: true` quando não fizer sentido "desanimar", `batch` para grades, e sempre um ramo de movimento reduzido.

---

### Exemplo 02 — Texto Scrubbed

📄 `src/examples/example02-scrub-text/animation.ts`

**1. O que faz.** Uma linha de texto gigante atravessa a tela horizontalmente (`x: -300 → 300`) enquanto o palco está visível. A linha contornada atrás mostra a posição original (`x: 0`). O HUD compara o **progress do scroll** com o **progress do playhead**.

**2. Conceito principal.** `scrub`: a barra de rolagem vira o playhead. E a diferença entre `false`, `true`, `0.5`, `1`.

**3. Como o ScrollTrigger funciona aqui.** A cada frame em que o scroll muda, o ScrollTrigger calcula `progress = (scroll − start) / (end − start)` e posiciona o playhead do tween nesse ponto — instantaneamente (`true`) ou suavizando (número). Com `scrub: false` ele volta a ser um "disparador" com `toggleActions: "play reverse play reverse"`.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.st-stage` — o palco inteiro (alto), não o texto. |
| **5. start** | `"top bottom"` — o palco começa a aparecer. |
| **6. end** | `"bottom top"` — o palco acabou de sair por cima. A animação dura **todo** o tempo em que o palco está visível. |
| **7. scrub** | padrão `true`. No painel: `false`, `true`, ou número (0.1–4s). |
| **8. pin** | não usa (o texto sobe com a página enquanto anda na horizontal). |
| **9. timeline** | não usa. |

**10. Propriedades usadas.**

```ts
gsap.fromTo(line,
  { x: -300 },                          // progress 0 (mobile: -150)
  {
    x: 300,                             // progress 1
    ease: "none",                       // linear: 10% de scroll = 10% de movimento
    duration: 1,                        // só importa com scrub: false
    onUpdate() { this.progress() },     // callback do TWEEN (playhead) — `this` = o tween
    scrollTrigger: {
      trigger: stage, start: "top bottom", end: "bottom top",
      scrub: true,
      toggleActions: "play reverse play reverse", // ignorado quando há scrub
      onUpdate: (self) => self.progress,          // callback do SCROLLTRIGGER (scroll)
    },
  });
```

`self.direction` (1 descendo, −1 subindo) também aparece no HUD.

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| `scrub` | `false` | o texto anda sozinho em 1s quando o palco entra; as barras do HUD se descolam totalmente |
| `scrub` | `true` | as duas barras do HUD andam **juntas**; cada tranco da roda aparece no texto |
| `scrub` | `0.5` / `1` / `4` | o playhead "persegue" o scroll com atraso crescente; ao parar de rolar, o texto ainda desliza |
| `fromX`/`toX` | −1000 / 1000 | mais distância no mesmo scroll = texto mais "rápido" |
| `ease` (com scrub) | power2.out | anda muito no começo do trecho e quase nada no fim |
| `start`/`end` | `top center` / `+=300` | trecho curto: a travessia acontece em 300px de scroll |

**13. Variações.**

```ts
// a) Duas linhas em sentidos opostos (xPercent = % da largura do próprio texto)
gsap.to(".row-1", { xPercent: -25, ease: "none", scrollTrigger: { trigger: stage, scrub: 1 } });
gsap.to(".row-2", { xPercent: 25,  ease: "none", scrollTrigger: { trigger: stage, scrub: 1 } });

// b) Rotação + escala ligadas a um trecho curto
gsap.to(word, { rotation: 20, scale: 1.3, ease: "none",
  scrollTrigger: { trigger: word, start: "top center", end: "+=600", scrub: true } });

// c) Mesmo efeito, mas só disparado (sem scrub) — compare a sensação
gsap.fromTo(line, { x: -300 }, { x: 300, duration: 1.2, ease: "power3.inOut",
  scrollTrigger: { trigger: stage, start: "top 70%", toggleActions: "play none none reverse" } });
```

**14. Problemas comuns.**
- **Scroll horizontal involuntário** — texto mais largo que a tela. Solução: `overflow-x: clip` no container (o `<main>` deste projeto). `clip` não cria container de scroll, então sticky/pin continuam funcionando; `hidden` pode quebrar `position: sticky`.
- **"Pulo" no carregamento** — se o `start` ficar antes do scroll 0 (elemento já na primeira tela), a animação começa "no meio". Use `"clamp(top bottom)"`.
- **Querer uma animação mais lenta aumentando `duration`** — com scrub não funciona; aumente a distância (`end`).
- **Usar `scrub` e esperar `toggleActions`** — um exclui o outro.

**15. Num projeto real.** Faixas de texto "marquee" em landing pages, manchetes que se deslocam, indicadores de progresso de leitura (`scaleX` ligado ao scroll da página). Prefira `scrub` entre 0.3 e 1 para suavizar a roda do mouse sem parecer atrasado.

---

### Exemplo 03 — Texto com Stagger

📄 `src/examples/example03-text-stagger/animation.ts`

**1. O que faz.** "SCROLL CHANGES EVERYTHING" é dividida em palavras (ou letras). Cada parte sobe de dentro de uma "máscara" (`overflow: hidden`), com rotação e fade, uma depois da outra.

**2. Conceito principal.** Um tween, **vários alvos**, inícios escalonados (`stagger`) — e como buscar vários elementos com escopo.

**3. Como o ScrollTrigger funciona aqui.** Igual ao exemplo 01 (dispara com `toggleActions`). O que muda é o tween: com `stagger`, o GSAP cria internamente um sub-tween por alvo, cada um começando `each` segundos depois do anterior. `tween.duration()` passa a incluir o escalonamento: com 3 palavras, `duration: 0.8` e `each: 0.1` → 0.8 + 0.1 × 2 = **1.0s** (valor lido do próprio tween e exibido na página).

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.sg-block` — o container da frase. Também é o **escopo** da busca pelos alvos. |
| **5. start** | `"top 75%"`. |
| **6. end** | não definido → padrão `"bottom top"`; só afeta `onLeave`/`onEnterBack` (que são `none` aqui). |
| **7. scrub** | não usa. |
| **8. pin** | não usa. |
| **9. timeline** | não usa. |

**10. Propriedades usadas.**

```ts
const targets = gsap.utils.toArray<HTMLElement>(".js-stagger-target", container); // query com escopo

gsap.from(targets, {
  yPercent: 110,          // 110% da altura do PRÓPRIO elemento → começa escondido sob a máscara
  rotation: 8,            // graus (mobile: 4)
  opacity: 0,
  duration: 0.8,          // duração de CADA alvo
  ease: "power3.out",
  stagger: { each: 0.1, from: "start" },   // ou { amount: 0.6, from: "center" }
  scrollTrigger: { trigger: container, start: "top 75%", toggleActions: "play none none reverse" },
});
```

- `stagger: 0.1` é atalho de `{ each: 0.1 }`.
- `each` = intervalo **fixo** entre alvos. `amount` = tempo **total** dividido entre eles.
- `from`: `"start"`, `"end"`, `"center"`, `"edges"`, `"random"` ou um índice.
- A divisão em spans é feita no JSX; o container tem `aria-label` com a frase inteira e os spans têm `aria-hidden` (leitores de tela leem a frase, não letra por letra).

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| `stagger` (each) | 0.1 → **0.3** | 0.1: as palavras quase se sobrepõem, parece um movimento único e fluido. 0.3: cada palavra completa boa parte do movimento antes da próxima começar — vira uma **sequência**, mais lenta e enfática. |
| alvos | palavras → letras | 3 → 23 alvos. Com `each: 0.1`, a última letra começa só em 2.2s. |
| modo | each → amount 0.6 | com letras, o tempo total volta a 0.6s não importa quantos alvos |
| `from` | center / edges / random | a "onda" parte do meio / das pontas / aleatória (visível com letras) |
| `yPercent` | 0 | sem efeito de máscara: só rotação + fade |
| `rotation` | −20 | as palavras "caem" do outro lado |
| `ease` | back.out(1.7) | cada palavra passa do ponto e volta |

**13. Variações.**

```ts
// a) Grade de cards, onda saindo do centro (grid: "auto" calcula linhas/colunas)
gsap.from(cards, { scale: 0.8, opacity: 0, stagger: { grid: "auto", from: "center", amount: 0.8 },
  scrollTrigger: { trigger: grid, start: "top 70%" } });

// b) Stagger COM scrub: as letras sobem conforme você rola
gsap.from(chars, { yPercent: 100, stagger: 0.05, ease: "none",
  scrollTrigger: { trigger: title, start: "top 80%", end: "top 30%", scrub: true } });

// c) Stagger por função: retorna o atraso TOTAL de cada alvo
gsap.from(items, { y: 40, opacity: 0, stagger: (i) => i * 0.08 + (i % 2) * 0.15 });

// d) Em projetos reais de tipografia: o plugin oficial SplitText (incluído no pacote gsap)
//    divide em linhas/palavras/letras e cuida de acessibilidade — https://gsap.com/docs/v3/Plugins/SplitText/
```

**14. Problemas comuns.**
- **Transform não funciona em `<span>`** — elementos `inline` ignoram `transform`. Use `display: inline-block` (feito no CSS).
- **Cantos cortados pela máscara com rotação** — dê um respiro de padding na máscara (há um no CSS).
- **`each` com muitos alvos** — 200 letras × 0.05 = 10s. Para muitos alvos, `amount`.
- **Leitores de tela lendo "S C R O L L"** — `aria-label` no container + `aria-hidden` nos pedaços.
- **Fontes carregando depois** mudam quebras de linha e alturas → `ScrollTrigger.refresh()` após `document.fonts.ready` (feito em `ScrollLab.tsx`).

**15. Num projeto real.** Títulos de hero, listas de features, grades de logos/cards. Em textos longos, divida por **linhas** (SplitText) em vez de letras — é mais legível e mais leve.

---

### Exemplo 04 — Imagem Reveal / Clip

📄 `src/examples/example04-image-reveal/animation.ts`

**1. O que faz.** Uma foto começa recortada (um retângulo menor no centro, com cantos arredondados) e o recorte se abre enquanto você rola; ao mesmo tempo a foto interna vai de `scale: 1.4` a `1`, e a legenda aparece no fim.

**2. Conceito principal.** Combinar **propriedades CSS** com a **interpolação do GSAP** — e saber o que é de quem.

**3. Como o ScrollTrigger funciona aqui.** Uma timeline com scrub. Os dois tweens principais estão na **posição 0** (começam juntos), a legenda na posição 0.6. `defaults: { ease: "none", duration: 1 }` → a timeline tem 1s, que é esticado entre start e end.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.rv-figure` — a figura externa, que **não** anima. O `clip-path` vai na moldura `.rv-clip` e o `scale` na `<img>`. |
| **5. start** | `"top 90%"` — a figura acabou de aparecer embaixo. |
| **6. end** | `"top 20%"` — topo da figura perto do topo da tela. Distância = 70% da altura da tela. |
| **7. scrub** | `true` (painel: 0.3–4). |
| **8. pin** | não usa. |
| **9. timeline** | sim: 3 tweens (clip na moldura, scale na imagem, legenda). |

**10. Propriedades — CSS × GSAP.**

| Propriedade | De quem | Papel |
| --- | --- | --- |
| `aspect-ratio: 16/9` (4/5 no mobile) | CSS | reserva o espaço antes da imagem carregar (sem layout shift) |
| `overflow: hidden` | CSS | a imagem em `scale: 1.4` não vaza da moldura |
| `object-fit: cover` | CSS | a foto preenche a moldura sem distorcer |
| `clipPath` | **GSAP** anima uma propriedade **CSS** | o GSAP lê os números dentro da string e interpola cada um: `"inset(30% 30% 30% 30% round 40px)"` → `"inset(0% 0% 0% 0% round 0px)"`. As duas strings precisam ter a **mesma estrutura** (mesma função, mesma quantidade de números, mesmas unidades). |
| `scale` | GSAP (atalho de `transform: scale()`) | afasta a "câmera" |
| `transformOrigin` | GSAP (atalho de `transform-origin`) | ponto que fica parado durante a escala |
| `opacity`, `y` | GSAP | legenda |

```ts
tl.fromTo(clip,  { clipPath: "inset(30% 30% 30% 30% round 40px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)" }, 0)
  .fromTo(image, { scale: 1.4, transformOrigin: "center center" }, { scale: 1 }, 0)
  .fromTo(caption, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6);
```

Performance: `transform` e `opacity` não recalculam layout; `clip-path` também não (afeta só a pintura). Animar `width`/`height` da moldura faria o navegador recalcular o layout a cada frame.

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| forma | bottom / left / circle | revela de baixo para cima / da esquerda para a direita / círculo que cresce (`circle(…)` → `circle(75% at 50% 50%)`) |
| % escondido | 100 | começa totalmente fechado |
| round inicial | 0 / 120 | cantos retos / "pílula" que se abre |
| scale inicial | 1 / 2 | sem zoom / zoom forte |
| transformOrigin | top center | a imagem "ancora" no topo enquanto diminui |
| start/end | end `"top 60%"` | o reveal acontece em menos scroll (mais rápido) |
| scrub | 2 | reveal com inércia |

**13. Variações.**

```ts
// a) Cortina de cima para baixo
gsap.fromTo(clip, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none",
  scrollTrigger: { trigger: figure, start: "top 80%", end: "top 30%", scrub: true } });

// b) Diagonal com polygon (mesmo número de pontos nos dois lados!)
gsap.fromTo(clip,
  { clipPath: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)" },
  { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", ease: "none",
    scrollTrigger: { trigger: figure, scrub: true } });

// c) Reveal disparado (sem scrub), como uma entrada
gsap.fromTo(clip, { clipPath: "inset(50% 50% 50% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)",
  duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: figure, start: "top 75%" } });
```

**14. Problemas comuns.**
- **Strings de formatos diferentes** (`inset()` → `circle()`, ou 4 números → 2): o GSAP não tem como interpolar; o valor "pula".
- **Esquecer `overflow: hidden`** com `scale > 1`: a imagem invade o conteúdo vizinho.
- **Imagem sem dimensão reservada**: ao carregar, empurra o layout e todos os start/end abaixo ficam errados.
- **Pôr o clip-path no trigger**: funciona (clip não muda o layout), mas separar trigger/moldura/imagem deixa claro quem mede e quem anima.

**15. Num projeto real.** Heros de portfólio, galerias editoriais, "cases". Combine com `loading="lazy"` + `aspect-ratio` e mantenha a imagem com resolução suficiente para o `scale` inicial.

---

### Exemplo 05 — Imagem Parallax

📄 `src/examples/example05-image-parallax/animation.ts`

**1. O que faz.** Uma foto dentro de uma moldura (`overflow: hidden`) se move verticalmente numa velocidade diferente do texto ao redor. O painel lateral mostra, num diagrama, a moldura e a imagem no início e no fim — e avisa quando sobra "buraco".

**2. Conceito principal.** **Parallax** = camadas com velocidades diferentes → sensação de profundidade. Imagem que sobe mais rápido que a página parece mais **perto**; mais devagar, mais **longe**.

**3. Como o ScrollTrigger funciona aqui.** Um `fromTo` de `yPercent` com `scrub: true` e `ease: "none"`, durante todo o tempo em que a moldura está visível. Antes disso, um `gsap.set()` define a **altura** da imagem (layout, não animação) com base na intensidade.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.px-frame` — a moldura (não anima). |
| **5. start** | `"top bottom"` — moldura começa a aparecer. |
| **6. end** | `"bottom top"` — moldura acabou de sair. |
| **7. scrub** | `true` — parallax precisa ser proporcional ao scroll. |
| **8. pin** | não usa. |
| **9. timeline** | não usa. |

**10. Propriedades usadas e a matemática.**

`yPercent: -20` = `translateY(-20%)` = 20% da altura **da própria imagem** (não da moldura). É aí que mora o "buraco":

```
moldura = 1 unidade de altura · imagem = H · deslocamento final = −P (fração)
base da imagem no fim = H × (1 − P)
para cobrir a moldura:  H × (1 − P) ≥ 1   →   H ≥ 1 / (1 − P)
```

| yPercent | Altura mínima da imagem | O que você vê |
| --- | --- | --- |
| −20 | 1 / 0.8 = **125%** | parallax sutil, elegante |
| −50 | 1 / 0.5 = **200%** | movimento forte; a imagem precisa ser ampliada (perde nitidez) |
| −100 | 1 / 0 = **∞** | impossível cobrir: a imagem percorre a própria altura inteira e **sai** da moldura. Sempre sobra buraco. |

```ts
gsap.set(image, { height: "125%", top: "0%", bottom: "auto" });   // layout (revertido pelo matchMedia)
gsap.fromTo(image, { yPercent: 0 }, {
  yPercent: -20, ease: "none",
  scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
});
```

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| intensidade | 20 → 50 → 100 | mais deslocamento; o diagrama mostra a imagem ficando 2× e depois 4× (limite) mais alta; em 100 aparece o aviso de buraco |
| compensar altura | desligar | altura 100%: no fim do scroll aparece uma faixa vazia (o diagrama pinta de rosa) |
| direção | down | `yPercent` positivo, imagem ancorada embaixo: fica **mais lenta** que a página (fundo distante) |
| scrub | 1 | parallax "flutuante", com atraso |
| start/end | `top center` / `bottom center` | o movimento só acontece na metade do trajeto |

**13. Variações.**

```ts
// a) Várias camadas com velocidades diferentes via data-attribute
gsap.utils.toArray<HTMLElement>("[data-speed]", scene).forEach((layer) => {
  gsap.to(layer, { yPercent: -Number(layer.dataset.speed) * 20, ease: "none",
    scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true } });
});

// b) Parallax em TEXTO (primeiro plano, mais rápido que a página)
gsap.to(title, { y: -120, ease: "none", scrollTrigger: { trigger: section, scrub: true } });

// c) Parallax horizontal: mesma fórmula na largura (imagem 125% de largura, xPercent -20)
gsap.fromTo(wideImage, { xPercent: 0 }, { xPercent: -20, ease: "none", scrollTrigger: { trigger: frame, scrub: true } });
```

**14. Problemas comuns.**
- **Buraco no fim** — altura calculada errada (pensar que `yPercent` é relativo à moldura).
- **Imagens borradas** — imagens 2× mais altas que a moldura são ampliadas; use fontes grandes ou intensidade baixa.
- **`background-attachment: fixed`** como "parallax de CSS" — não funciona bem em iOS; transform + scrub funciona em todo lugar.
- **Muitas camadas animando** — cada uma é barata (transform), mas dezenas de imagens grandes custam GPU/memória.
- **Enjoo** — parallax forte em mobile e para quem pede movimento reduzido. Daí o `× 0.6` e o ramo `reduceMotion`.

**15. Num projeto real.** Heros, fotos de separação entre seções, cenas com camadas (céu, montanhas, texto). Intensidades entre 10 e 25 costumam bastar.

---

### Exemplo 06 — Vídeo controlado pelo Scroll

📄 `src/examples/example06-video-scroll/animation.ts`

**1. O que faz.** Uma flor desabrocha conforme você rola; rolando para cima, ela fecha. O vídeo fica parado na tela (CSS `position: sticky`) enquanto um "trilho" de 3 telas passa. O HUD mostra `progress`, `currentTime / duration` e o frame. (Teste automatizado: no meio do trilho, `currentTime` = 2.5025s de 5.005s.)

**2. Conceito principal.** Tratar o vídeo como uma animação: `currentTime = progress × duration` — com carregamento robusto do metadata.

**3. Como o ScrollTrigger funciona aqui.** O ScrollTrigger mede o trilho e produz um `progress` de 0 a 1. Dois métodos (escolha no painel):

```ts
// Método "tween": o GSAP interpola a propriedade numérica currentTime (aceita scrub numérico)
gsap.fromTo(video, { currentTime: 0 }, { currentTime: duration, ease: "none",
  scrollTrigger: { trigger: track, start: "top top", end: "bottom bottom", scrub: 0.5 } });

// Método "onUpdate": a conversão explícita, sem suavização
ScrollTrigger.create({ trigger: track, start: "top top", end: "bottom bottom",
  onUpdate: (self) => { video.currentTime = self.progress * duration; } });
```

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.vs-track` — o trilho alto (altura = N telas, controlada no painel). |
| **5. start** | `"top top"` — topo do trilho no topo da tela = o sticky começa a segurar o vídeo. |
| **6. end** | `"bottom bottom"` — base do trilho na base da tela = o sticky solta. O progress vai de 0 a 1 **exatamente** enquanto o vídeo está parado na tela. Distância = altura do trilho − altura da tela (3 telas → 2 telas de scroll). |
| **7. scrub** | método tween: `0.5` (painel: true…4). Método onUpdate: não existe (não há animação ligada ao ScrollTrigger para suavizar). |
| **8. pin** | não. O vídeo fica na tela por **CSS sticky** — compare com o `pin` do exemplo 07. |
| **9. timeline** | não. |

**Por que `duration` precisa ser conhecida antes de controlar `currentTime`:**

1. Antes do metadata, `video.duration` é `NaN`. `progress × NaN = NaN` e **`video.currentTime = NaN` lança `TypeError`** ("valor não finito"). O código quebraria no primeiro scroll.
2. `currentTime: duration` é lido **uma vez**, quando o tween é criado. Criar com um chute (ex.: 1s) num vídeo de 5s faria o scroll inteiro percorrer só o primeiro segundo.
3. Streams ao vivo têm `duration = Infinity` — não dá para mapear (o código valida com `Number.isFinite`).

**A sequência robusta (em `animation.ts` + `Example06VideoScroll.tsx`):**

```ts
useGSAP((context, contextSafe) => {
  const build = contextSafe(() => { mm = createVideoScroll({ track, video }, params); });
  const stopWaiting = waitForMetadata(video, build, onError);  // listeners com cleanup
  return () => { stopWaiting(); mm?.revert(); };
});

function waitForMetadata(video, onReady, onError) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) { onReady(); return () => {}; } // já chegou (cache)
  video.addEventListener("loadedmetadata", onReady, { once: true });
  video.addEventListener("error", onError, { once: true });
  return () => { /* removeEventListener dos dois */ };
}
```

- `readyState ≥ 1` cobre o caso em que o metadata **já chegou** antes do React montar — o evento não dispara de novo, então só ouvir `loadedmetadata` seria frágil.
- `contextSafe` porque a animação é criada **depois** que o `useGSAP` terminou; sem ele, o tween não seria revertido no cleanup.
- O cleanup remove os listeners se o componente desmontar antes do metadata (StrictMode faz exatamente isso em desenvolvimento).
- `primeVideo()`: `play()` + `pause()` imediato "destrava" a decodificação no Safari/iOS; se o navegador bloquear, é ignorado.

**Atributos do `<video>`:** `muted` + `playsInline` (necessários para mobile), `preload="auto"` (baixa o arquivo para o scrub responder rápido; `"metadata"` baixaria só o cabeçalho), `poster` (imagem antes do primeiro frame) e a moldura com `aspect-ratio` (sem layout shift enquanto o vídeo carrega).

**O arquivo de vídeo importa.** Vídeos comprimidos guardam um *keyframe* completo a cada N frames; os outros são diferenças. Para mostrar um frame qualquer, o navegador decodifica desde o keyframe anterior — no scrub (principalmente para trás) isso trava. `flower-scrub.mp4` foi gerado com `ffmpeg … -g 1` (todo frame é keyframe): arquivo maior, seek instantâneo.

**10. Propriedades usadas.** `currentTime` (propriedade do elemento vídeo, interpolada pelo GSAP como qualquer número), `ease: "none"`, `scrollTrigger.{trigger,start,end,scrub,onUpdate}`, `ScrollTrigger.create()`, `self.progress`.

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| método | onUpdate | seek direto a cada atualização: mais "cru", segue cada tranco da roda |
| scrub | true / 2 | direto / o vídeo "desliza" até o ponto do scroll |
| altura do trilho | 1.5 / 8 telas | o vídeo inteiro em meia tela de scroll (rápido) / em 7 telas (controle fino, frame a frame) |
| start/end | `top center` / `bottom center` | o vídeo começa a tocar antes de ficar preso na tela |

**13. Variações.**

```ts
// a) Com pin em vez de sticky
gsap.fromTo(video, { currentTime: 0 }, { currentTime: duration, ease: "none",
  scrollTrigger: { trigger: section, pin: true, start: "top top", end: "+=2000", scrub: true } });

// b) Só um trecho do vídeo (de 1.5s a 3.5s)
gsap.fromTo(video, { currentTime: 1.5 }, { currentTime: 3.5, ease: "none", scrollTrigger: { trigger: track, scrub: true } });

// c) Sequência de imagens em <canvas> (técnica das páginas da Apple): mais pesada para baixar,
//    mas perfeitamente suave. Anima-se um número (o índice do frame) e desenha no onUpdate.
const state = { frame: 0 };
gsap.to(state, { frame: images.length - 1, ease: "none",
  scrollTrigger: { trigger: track, start: "top top", end: "bottom bottom", scrub: 0.5 },
  onUpdate: () => draw(images[Math.round(state.frame)]) });
```

**14. Problemas comuns.**
- Criar a animação antes do metadata (`NaN`, mapeamento errado).
- Vídeo com keyframes espaçados → scrub travado, principalmente para trás.
- `preload="none"`/`"metadata"` num vídeo de scrub → trava até baixar.
- iOS: vídeo sem `muted`/`playsInline`, ou nunca "tocado".
- Arquivo grande demais: corte a duração, reduza a resolução, remova o áudio (`-an`).
- Esquecer de remover listeners no cleanup (vazamento + animação criada num componente já desmontado).

**15. Num projeto real.** Páginas de produto ("o objeto gira conforme você rola"), explicações passo a passo. Para trechos longos ou muito detalhados, prefira sequência de imagens em canvas.

---

### Exemplo 07 — Vídeo com Pin

📄 `src/examples/example07-video-pin/animation.ts`

**1. O que faz.** A seção de vídeo fica presa na tela por 3 alturas de tela. Nesse trecho, o vídeo cresce de um "card" (`scale: 0.6`, cantos arredondados) para tela cheia, escurece levemente e três legendas entram e saem em sequência. Depois do pin, um bloco de texto explica o que o `pinSpacing` fez.

**2. Conceito principal.** `pin` e o **pin-spacer**: o elemento fica fixo, a página continua rolando, e o documento reserva o espaço do pin.

**3. Como o ScrollTrigger funciona aqui.** Uma timeline com `scrollTrigger: { pin: true, scrub: 1 }`. Entre `start` e `end` o ScrollTrigger aplica `position: fixed` na seção (o teste confirma `position: fixed` no meio do pin) e o progress do scroll move a timeline.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.vp-section` — é o trigger **e** o elemento pinado. **Nada nela é animado.** |
| **5. start** | `"top top"` — o topo da seção encosta no topo da tela (padrão quando há pin). |
| **6. end** | `() => "+=" + window.innerHeight * 3` — 3 telas de scroll após o start. Função → recalculada em cada refresh. |
| **7. scrub** | `1`. |
| **8. pin** | `pin: true` + `pinSpacing: true` + `anticipatePin: 1`. Pin-spacer medido: 900 (seção) + 2700 (padding) = 3600px. |
| **9. timeline** | sim — veja abaixo. |

**A regra: não anime o elemento pinado.** O ScrollTrigger mede a seção para criar o pin-spacer e fixar sua largura/altura/posição. Se ela própria tivesse `scale`/`y`/`width` animados, a medição (feita no refresh, no resize) pegaria um estado deformado qualquer: o pin-spacer ficaria com o tamanho errado, o elemento "pularia" ao pinar/soltar e os start/end de tudo abaixo ficariam deslocados. **Solução:** pinar o container e animar **filhos** (`.vp-media`, `.vp-shade`, `.vp-caption`).

**9. A timeline (duração total 4.9s):**

```ts
tl.fromTo(media, { scale: 0.6, borderRadius: 28 }, { scale: 1, borderRadius: 0, duration: 1 }) // 0   → 1
  .to(shade, { opacity: 0.55, duration: 0.4 }, "-=0.3");                                       // 0.7 → 1.1
captions.forEach((c, i) => {
  tl.fromTo(c, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 0.4 });  // entra
  if (i < captions.length - 1) tl.to(c, { autoAlpha: 0, yPercent: -40, duration: 0.4 }, "+=0.6"); // fica 0.6, sai
});
tl.to({}, { duration: 0.6 });   // "respiro": tween vazio — o pin continua sem nada mudar
```

Com 3 telas de 900px, cada "segundo" dessa timeline vale ~550px de scroll.

**10. Propriedades usadas.** `pin`, `pinSpacing`, `anticipatePin`, `invalidateOnRefresh`, `start`, `end` (função), `scrub`, callbacks `onUpdate`, `onToggle` (play/pause do vídeo só enquanto o pin está ativo — `self.isActive`), `onRefresh` (`self.end − self.start` no HUD); no tween: `scale`, `borderRadius`, `opacity`, `autoAlpha`, `yPercent`, position parameter `"-=0.3"` e `"+=0.6"`.

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| end (telas) | 1 / 6 | pin curto: tudo acontece rápido / pin longo: cada legenda fica muito tempo |
| pinSpacing | false | o bloco "depois do pin" sobe **por cima** do vídeo preso — nenhum espaço reservado |
| scrub | true | legendas seguem cada tranco da roda |
| scale inicial | 1 | sem efeito de "card" |

**13. Variações.**

```ts
// a) Seções empilhadas (cada uma pina e a próxima passa por cima)
gsap.utils.toArray<HTMLElement>(".panel", container).forEach((panel) => {
  ScrollTrigger.create({ trigger: panel, start: "top top", pin: true, pinSpacing: false });
});

// b) Layout em duas colunas: pina SÓ a coluna do vídeo enquanto o texto rola ao lado
ScrollTrigger.create({ trigger: ".split", start: "top top", end: "bottom bottom", pin: ".split__video" });

// c) Pin + vídeo scrubbed (juntando com o exemplo 06), na mesma timeline.
//    Só depois do metadata (video.duration válido) — veja waitForMetadata no exemplo 06.
tl.fromTo(video, { currentTime: 0 }, { currentTime: video.duration, duration: tl.duration(), ease: "none" }, 0);
```

**14. Problemas comuns.** Todos os da seção 3.6 — em especial: animar o pinado, `transform`/`will-change` em ancestrais, criar triggers fora de ordem, `100vh` no mobile (aqui: `100svh` no CSS), e deixar vídeos tocando fora da tela.

**15. Num projeto real.** Seções de "storytelling" com vídeo de fundo, apresentações de produto, depoimentos em vídeo com legendas sincronizadas ao scroll.

---

### Exemplo 08 — Timeline Cinematic

📄 `src/examples/example08-cinematic-timeline/animation.ts`

**1. O que faz.** Uma cena pinada em seis passos: (1) o título entra, (2) a foto aparece com o recorte abrindo, (3) a foto cresce, (4) o título sobe e diminui, (5) uma legenda aparece, (6) a foto diminui e vai para o lado. Uma **régua** (tipo Gantt) desenha onde cada tween começa e quanto dura; a agulha branca é `tl.time()`.

**2. Conceito principal.** `gsap.timeline()` e o **position parameter** — sequência, sobreposição, pausa, duração relativa.

**3. Como o ScrollTrigger funciona aqui.** **Um** ScrollTrigger na timeline (pin + scrub). Os tweens filhos **não** têm ScrollTrigger próprio.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.cn-stage` (trigger + pin, não animado). |
| **5. start** | `"top top"`. |
| **6. end** | `() => "+=" + innerHeight * 4`. |
| **7. scrub** | `1`. |
| **8. pin** | sim (`anticipatePin: 1`). |
| **9. timeline** | 6 tweens + `defaults: { ease: "power2.inOut", duration: 1 }`. |

**Os tempos com as posições padrão** (os mesmos que a régua mostra):

```ts
gsap.set(media, { scale: 0.7 });                                         // estado inicial (fora da timeline)
tl.from(title, { yPercent: 60, autoAlpha: 0 })                           // 1:  0   → 1
  .fromTo(media, { autoAlpha: 0, clipPath: "inset(18%… round 24px)" },
                 { autoAlpha: 1, clipPath: "inset(0%… round 24px)" }, ">")  // 2:  1   → 2    fim do anterior
  .to(media, { scale: 1, duration: 1.5 }, ">")                            // 3:  2   → 3.5  fim do anterior
  .to(title, { y: () => -stage.clientHeight * 0.36, scale: 0.42 }, "<")   // 4:  2   → 3    JUNTO com o 3
  .fromTo(caption, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8 }, "-=0.5") // 5: 3.0 → 3.8
  .to(media, { scale: 0.58, xPercent: -20 }, "+=1");                      // 6:  4.8 → 5.8  pausa de 1s
// tl.duration() = 5.8
```

Leia com atenção o passo 5: `"-=0.5"` é relativo ao **fim da timeline** (3.5, fim do passo 3 — o mais longo), não ao fim do passo 4. E o passo 6 com `"+=1"` cria 1s de "nada acontecendo" = ~620px de scroll com a cena parada.

**10. Propriedades usadas.** `defaults`, `.from()`, `.fromTo()`, `.to()`, position parameters (`">"`, `"<"`, `"-=0.5"`, `"+=1"`), `gsap.set()`, `autoAlpha`, `clipPath`, `scale`, `xPercent`, `yPercent`, `y` **com função** + `invalidateOnRefresh` (o deslocamento do título depende da altura da tela), `onUpdate` da timeline (`this.time()`), `tl.getChildren()` + `startTime()` + `duration()` (para desenhar a régua).

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito na régua / na cena |
| --- | --- | --- |
| passo 4 | `">"` | o título espera a foto terminar de crescer; tudo fica mais sequencial e a timeline mais longa |
| passo 2 | `"<"` | a foto surge **junto** com o título |
| passo 5 | `"+=0.5"` | a legenda espera meio segundo depois de tudo |
| passo 6 | `"<"` | começa junto com o passo 5 |
| passo 6 | `"<0.5"` e passo 3 `"<"` | sobreposições na mesma propriedade (`scale` da foto): veja o conflito |
| ease | none / expo.inOut | movimento mecânico / "cinematográfico" com acelerações fortes |
| end (telas) | 2 / 8 | a mesma timeline em menos/mais scroll (duração relativa) |

**13. Variações.**

```ts
// a) Labels como capítulos e posições relativas a eles
tl.addLabel("zoom")
  .to(media, { scale: 1.2 }, "zoom")
  .to(title, { opacity: 0 }, "zoom+=0.3");

// b) Timelines aninhadas: cada cena é uma função que devolve uma timeline
const intro = () => gsap.timeline().from(title, { y: 50, opacity: 0 }).from(sub, { opacity: 0 }, "<0.2");
const master = gsap.timeline({ scrollTrigger: { trigger: stage, pin: true, scrub: 1, end: "+=3000" } });
master.add(intro()).add(outro(), "+=0.5");

// c) A mesma timeline SEM scrub: toca por tempo quando a seção entra
gsap.timeline({ scrollTrigger: { trigger: stage, start: "top 60%", toggleActions: "play none none reverse" } });
```

**14. Problemas comuns.**
- `scrollTrigger` em tweens **filhos** da timeline (um controle brigando com o outro).
- Dois tweens na mesma propriedade/elemento sobrepostos.
- `from()` em timelines renderiza o estado inicial na criação (`immediateRender`): se o mesmo elemento tem outro `from()` depois, o segundo lê o estado já alterado. Prefira `fromTo()` quando o mesmo elemento aparece em vários passos.
- Valores dependentes da tela sem função + `invalidateOnRefresh`: após o resize, o título iria para o lugar antigo.
- Timeline muito longa em pouco scroll: tudo parece "corrido". Aumente o `end`.

**15. Num projeto real.** Heros de lançamento, "capítulos" de uma página institucional, apresentações de produto em sequência. Planeje a timeline no papel (quem, quando, quanto dura) antes de escrever.

---

### Exemplo 09 — Pin + Movimento Horizontal

📄 `src/examples/example09-horizontal-pin/animation.ts`

**1. O que faz.** A seção é pinada e, enquanto você rola para baixo, a fileira (painel de introdução + CARD 01, 02, 03) anda para a esquerda até o último card encostar na borda direita. Uma barra mostra o progresso; o HUD mostra as medidas.

**2. Conceito principal.** Converter scroll vertical em movimento horizontal com uma distância **medida**, não suposta — e um `end` dinâmico.

**3. Como o ScrollTrigger funciona aqui.** Timeline com pin + scrub; dois tweens na posição 0 (a fileira e a barra). O `end` e o `x` são **funções**, reavaliadas em todo `refresh()` graças ao `invalidateOnRefresh: true`.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.hz-section` (trigger + pin, não animada). A fileira `.hz-track` é que anima. |
| **5. start** | `"top top"`. |
| **6. end** | `() => "+=" + getDistance() * speed` — dinâmico. |
| **7. scrub** | `1`. |
| **8. pin** | sim. |
| **9. timeline** | `tl.to(track, { x: () => -getDistance() }, 0)` + `tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, 0)`. |

**Por que a distância precisa ser calculada:**

```
┌──────── section.clientWidth (visível) ────────┐
│ [intro] [ card 01 ] [ card 02 ]│[ card 03 ]      ← a fileira é mais larga que a tela
└───────────────────────────────────────────────┘
├───────────────── track.scrollWidth (conteúdo total) ─────────────┤

distância = track.scrollWidth − section.clientWidth
```

- `scrollWidth` = largura **total** do conteúdo, inclusive o que está fora da tela.
- `clientWidth` = largura **visível** do elemento, **sem** a barra de rolagem. (`window.innerWidth` inclui a barra vertical — no Windows, ~17px de erro.)
- `offsetWidth` = largura da caixa com bordas — não diz quanto conteúdo transborda.

Medido no teste a 1440px: `scrollWidth` 3263 − `clientWidth` 1440 = **1823px** de movimento; com `speed: 1`, o `end − start` também é 1823px, e o pin-spacer ficou com 900 + 1823 = 2723px. Andar menos que isso corta o último card; andar mais deixa um vazio à direita. Como os cards usam `vw` (62vw no desktop, 84vw no mobile), o número muda com a tela — por isso **nunca** fica fixo no código. Teste de resize: a 1440, 900 e 600px de largura, o último card terminou exatamente em `clientWidth − gutter` (1384, 864, 576).

**O modo "xPercent" (ingênuo), para comparar:** o demo clássico faz `gsap.to(panels, { xPercent: -100 * (panels.length - 1) })`. Como `xPercent` é relativo à largura **de cada painel**, isso só dá certo quando todos os painéis têm 100% da largura da tela e não há gaps. Aqui o painel de introdução é mais estreito e há espaçamento: cada painel anda uma distância diferente, eles se desencontram e o último para no lugar errado.

**Responsividade — os cuidados:**
- Largura dos cards via CSS (`vw`/`clamp`); o JS só mede.
- `end` e `x` como **funções** + `invalidateOnRefresh: true`.
- ScrollTrigger já faz `refresh()` no resize; `ignoreMobileResize: true` (em `gsapSetup.ts`) evita refresh quando só a barra de endereço do celular muda a altura.
- `height: 100svh` na seção pinada (altura estável no mobile).
- Imagens com dimensões reservadas: se uma imagem carregasse depois mudando a largura de um card, a distância medida ficaria velha.
- No touch, o gesto vertical continua sendo scroll nativo: funciona sem nenhum código extra.
- Movimento reduzido: sem pin — a fileira vira um carrossel nativo com `overflow-x: auto` + `scroll-snap`.

**10. Propriedades usadas.** `pin`, `scrub`, `start`, `end` (função), `invalidateOnRefresh`, `anticipatePin`, `onRefresh` (medidas no HUD), `x` (função), `xPercent` (modo ingênuo), `scaleX`, `ease: "none"` (movimento proporcional ao scroll).

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| cálculo | xPercent | painéis se desencontram; o último não para na borda |
| speed | 2 | o dobro de scroll para o mesmo movimento (mais lento, mais controle) |
| speed | 0.5 | metade do scroll (rápido) |
| scrub | true | a fileira segue cada tranco da roda |
| redimensionar a janela | — | os números do HUD mudam e o alinhamento final continua perfeito |

**13. Variações.**

```ts
// a) O demo clássico: painéis de 100vw, snap por painel
gsap.to(panels, { xPercent: -100 * (panels.length - 1), ease: "none",
  scrollTrigger: { trigger: container, pin: true, scrub: 1,
    snap: 1 / (panels.length - 1), end: () => "+=" + container.offsetWidth } });

// b) Animar elementos DENTRO do movimento horizontal: containerAnimation
const move = gsap.to(track, { x: () => -getDistance(), ease: "none",   // ease "none" é obrigatório aqui
  scrollTrigger: { trigger: section, pin: true, scrub: 1, end: () => "+=" + getDistance() } });
gsap.from(card, { y: 100, opacity: 0,
  scrollTrigger: { trigger: card, containerAnimation: move, start: "left center", toggleActions: "play none none reverse" } });

// c) Snap em cada card, com posições medidas (cards de larguras diferentes)
snap: (value) => gsap.utils.snap(cards.map((c) => c.offsetLeft / getDistance()), value),
```

**14. Problemas comuns.** Distância fixa em px; `innerWidth` em vez de `clientWidth`; esquecer `invalidateOnRefresh` (o `x` fica com o valor antigo depois do resize); scroll horizontal da **página** (o `overflow: hidden` da seção pinada evita); `ease` diferente de `"none"` (o movimento deixa de acompanhar o scroll); snap com `containerAnimation` (não suportado).

**15. Num projeto real.** Galerias de projetos, linhas do tempo, "features" em sequência. Mantenha uma alternativa acessível (carrossel nativo) e não exagere na distância: 3–6 painéis costumam bastar.

---

### Exemplo 10 — Snap + Scroll Story

📄 `src/examples/example10-snap-story/animation.ts`

**1. O que faz.** Uma seção pinada com quatro momentos empilhados: texto introdutório → imagem → vídeo → mensagem final. As transições são uma timeline com scrub; cada momento é um **label**; ao parar de rolar, o **snap** leva o scroll até o momento mais próximo (na direção em que você rolava). Botões numerados levam direto a cada momento; o vídeo só toca no momento 03.

**2. Conceito principal.** `snap` — encaixar o progresso em pontos definidos — usando **labels** da timeline.

**3. Como o ScrollTrigger funciona aqui.** Timeline com pin + scrub + `snap: { snapTo: "labels", … }`. Os labels ficam nos tempos 0, 1.5, 3 e 4.5 de uma timeline de 4.5s → progressos **0, 0.333, 0.667, 1** (a lista no HUD). Depois que o scroll para (+ `delay`), o ScrollTrigger anima a posição do scroll até o progress do label escolhido.

| Ficha técnica | |
| --- | --- |
| **4. Trigger** | `.sn-section` (trigger + pin, não animada). As `.sn-layer` é que animam. |
| **5. start** | `"top top"`. |
| **6. end** | `() => "+=" + innerHeight * telasPorMomento * (momentos − 1)` → 1 × 900 × 3 = 2700px. |
| **7. scrub** | `1`. |
| **8. pin** | sim. |
| **9. timeline** | label → (respiro) → transição → label… |

```ts
tl.addLabel("intro", 0);
for (let i = 1; i < layers.length; i++) {
  tl.to({}, { duration: hold })                                                   // respiro: momento anterior parado
    .to(layers[i - 1], { autoAlpha: 0, yPercent: -6, scale: 0.97 })              // sai
    .fromTo(layers[i], { autoAlpha: 0, yPercent: 6, scale: 1.04 },
                       { autoAlpha: 1, yPercent: 0, scale: 1 }, "<")               // entra junto
    .addLabel(labels[i]);                                                         // "imagem", "video", "final"
}
```

**snap, em detalhes:**

```ts
snap: {
  snapTo: "labels",               // ou 1 / (n − 1), ou 0.1, ou [..], ou função
  duration: { min: 0.2, max: 0.8 },
  delay: 0.1,                     // espera após o scroll parar
  ease: "power1.inOut",
  directional: true,              // próximo ponto NA DIREÇÃO do scroll
}
```

- **Com progress:** `snapTo: 1 / (n − 1)` encaixa em 0, 0.333, 0.667, 1. Aqui dá o mesmo resultado que labels porque os momentos são igualmente espaçados. `snapTo: 0.1` encaixa de 10 em 10% — e para no meio das transições (teste no painel).
- **Com labels:** os pontos acompanham a timeline. Se uma transição ficar mais longa que as outras, os labels continuam no lugar certo; `1/(n−1)` não.
- **`labelToScroll("video")`** converte um label em `scrollY` (px) — os botões fazem `window.scrollTo({ top: st.labelToScroll(label), behavior: "smooth" })`.
- **`currentLabel()`** diz o último label pelo qual o playhead passou. É lido no `onUpdate` **da timeline** (não do ScrollTrigger): com `scrub: 1`, a timeline continua andando depois que o scroll para, e só o callback dela acompanha isso.
- **`onSnapComplete`** mostra o progress encaixado e o label correspondente.

**Como alterar a quantidade de momentos:** edite o array `MOMENTS` em `Example10SnapStory.tsx` (adicione `{ label: "extra", kind: "text", … }`). O JSX cria a camada, o loop cria a transição e o label, o `end` cresce com `(n − 1)`, e o snap passa a ter um ponto a mais — sem mudar nada no `animation.ts`.

**Como controlar a distância entre os momentos:** `telasPorMomento` (scroll entre dois labels) e `hold` (quanto desse trecho o momento fica parado antes da transição começar).

**10. Propriedades usadas.** `snap` (`snapTo`, `duration {min,max}`, `delay`, `ease`, `directional`), `addLabel`, `labels`, `currentLabel()`, `labelToScroll()`, `onSnapComplete`, `onToggle` (pausa o vídeo fora do pin), `onUpdate` da timeline, tween vazio `tl.to({}, { duration })`, `autoAlpha`, `yPercent`, `scale`, position `"<"`.

**11–12. O que alterar e o que acontece.**

| Parâmetro | Experimente | Efeito |
| --- | --- | --- |
| snapTo | 0.1 | encaixa no meio das transições (pontos que não significam nada para o conteúdo) |
| snapTo | sem snap | para onde você soltar |
| directional | false | encaixa no ponto mais **próximo**, mesmo que seja para trás |
| duration.max | 2 | encaixe lento, "preguiçoso" |
| delay | 0.6 | demora para encaixar depois que você para |
| distância entre momentos | 3 telas | cada transição pede muito scroll (o snap vira um salto longo) |
| respiro (hold) | 0 / 2 | sem pausa: sempre em transição / cada momento fica bem parado |

**13. Variações.**

```ts
// a) Pontos arbitrários
snap: [0, 0.2, 0.7, 1]

// b) Terços, sempre para o ponto mais próximo e sem considerar a velocidade do scroll
snap: { snapTo: 1 / 3, directional: false, inertia: false, duration: 0.4 }

// c) Quatro seções independentes, cada uma com o próprio pin e snap no fim
//    (quando os momentos têm alturas/conteúdos muito diferentes)
```

**14. Problemas comuns.** Snap em conteúdo longo de leitura; snap brigando com CSS `scroll-snap`; distâncias grandes entre pontos; esquecer que a `inertia` (padrão) pode levar a um ponto além do esperado num scroll rápido; ler `currentLabel()` no callback do ScrollTrigger com scrub numérico (valor atrasado).

**15. Num projeto real.** Narrativas em etapas ("como funciona em 4 passos"), onboarding, apresentações. Mantenha os botões de navegação (acessíveis por teclado) e a versão estática para movimento reduzido.

---

## 5. Tabela de experimentação

Todas as propriedades e APIs usadas nos 10 exemplos. "Onde" diz em qual objeto a propriedade vive.

### ScrollTrigger (dentro de `scrollTrigger: {…}` ou `ScrollTrigger.create({…})`)

| Propriedade | O que controla | Exemplo | No lab |
| --- | --- | --- | --- |
| `trigger` | elemento cuja posição define start/end | `section` | todos |
| `start` | início: "ponto do trigger" + "linha da viewport" | `"top 80%"`, `"top top"` | todos |
| `end` | fim (mesma sintaxe) ou distância a partir do start | `"bottom top"`, `"+=1000"`, `() => "+=" + w` | todos |
| `scrub` | relação scroll → playhead | `true`, `0.5`, `1` | 02, 04–10 |
| `toggleActions` | ações em onEnter/onLeave/onEnterBack/onLeaveBack (sem scrub) | `"play none none reverse"` | 01, 03 |
| `once` | mata o trigger após o primeiro onEnter | `true` | (variação 01) |
| `pin` | fixa um elemento entre start e end | `true`, `".coluna"` | 07–10 |
| `pinSpacing` | reserva (padding) a distância do pin no documento | `true`, `false`, `"margin"` | 07 |
| `anticipatePin` | aplica o pin um pouco antes em scrolls rápidos | `1` | 07–10 |
| `invalidateOnRefresh` | recalcula valores-função da animação a cada refresh | `true` | 07–10 |
| `snap` | encaixa o progress após o scroll parar | `"labels"`, `0.25`, `[0, .5, 1]` | 10 |
| `snap.snapTo` | pontos de encaixe (forma objeto) | `"labels"`, `1/3` | 10 |
| `snap.duration` | duração do encaixe | `{ min: 0.2, max: 0.8 }` | 10 |
| `snap.delay` | espera após o scroll parar | `0.1` | 10 |
| `snap.directional` | encaixa na direção do scroll | `true` | 10 |
| `snap.ease` | curva do encaixe | `"power1.inOut"` | 10 |
| `markers` | desenha start/end/scroller-start/scroller-end | `true` | todos (painel) |
| `id` | nome do trigger (aparece nos markers) | `"07-video-pin"` | todos |
| `onEnter` / `onLeave` / `onEnterBack` / `onLeaveBack` | callbacks ao cruzar start/end | `() => log()` | 01 |
| `onUpdate` | a cada mudança de scroll dentro do intervalo | `(self) => self.progress` | 02, 04–10 |
| `onToggle` | ao entrar/sair do intervalo ativo | `(self) => self.isActive` | 07, 10 |
| `onRefresh` | após recalcular posições | `(self) => self.end - self.start` | 07, 09 |
| `onSnapComplete` | quando o snap termina | `(self) => self.progress` | 10 |
| `containerAnimation` | triggers dentro de um movimento horizontal | `move` | (variação 09) |

### Instância e métodos estáticos do ScrollTrigger

| API | O que é | No lab |
| --- | --- | --- |
| `self.progress` | 0–1 entre start e end | 02, 04–10 |
| `self.direction` | `1` descendo, `-1` subindo | 02 |
| `self.isActive` | está entre start e end? | 07, 10 |
| `self.start` / `self.end` | posições em px de scroll | 07, 09 |
| `self.animation` | a animação ligada ao trigger | — |
| `st.labelToScroll("label")` | label → posição de scroll (px) | 10 |
| `ScrollTrigger.create({...})` | trigger sem animação (só callbacks) | 06 |
| `ScrollTrigger.refresh()` | recalcula todas as posições | `useLabParams`, `ScrollLab` |
| `ScrollTrigger.sort()` | reordena por refreshPriority e start | `useLabParams` |
| `ScrollTrigger.config({ ignoreMobileResize: true })` | ignora resizes verticais de barra de endereço (touch) | `gsapSetup.ts` |
| `ScrollTrigger.batch()` | callbacks agrupados para muitos elementos | (variação 01) |

### Tween vars (propriedades animáveis e especiais)

| Propriedade | O que controla | Exemplo | No lab |
| --- | --- | --- | --- |
| `x` / `y` | translação em px | `x: 300`, `y: -100` | 01, 02, 08 |
| `xPercent` / `yPercent` | translação em % do **próprio** elemento | `yPercent: -20` | 03, 05, 07–10 |
| `scale` / `scaleX` | escala | `1.2`, `scaleX: 0 → 1` | 04, 07–10 |
| `rotation` | rotação em graus | `45` | 03 |
| `transformOrigin` | ponto fixo de scale/rotation | `"top center"` | 04 |
| `opacity` | transparência | `0 → 1` | 01, 03, 04, 07 |
| `autoAlpha` | opacity + `visibility: hidden` em 0 | `0 → 1` | 07, 08, 10 |
| `clipPath` | recorte (string interpolada número a número) | `"inset(30% … round 40px)"` | 04, 08 |
| `borderRadius` | cantos (propriedade CSS) | `28 → 0` | 07 |
| `currentTime` | tempo do vídeo (propriedade do elemento) | `0 → duration` | 06 |
| `height` / `top` / `bottom` (via `gsap.set`) | layout, **não animado** | `"125%"` | 05 |
| `duration` | segundos (com scrub: proporção) | `1` | todos |
| `ease` | curva de velocidade | `"power2.out"`, `"none"` | todos |
| `stagger` | defasagem entre alvos | `0.1`, `{ each, amount, from }` | 03 |
| `stagger.each` | intervalo fixo entre alvos | `0.1` | 03 |
| `stagger.amount` | tempo total dividido entre alvos | `0.6` | 03 |
| `stagger.from` | origem da onda | `"center"`, `"edges"`, `"random"` | 03 |
| `onUpdate` (tween/timeline) | a cada render do playhead (inclusive catch-up do scrub) | `function () { this.progress() }` | 02, 08, 10 |
| `immediateRender` | aplicar o estado inicial na criação (padrão `true` em from/fromTo) | `false` | (conceito) |

### Timeline

| API | O que controla | Exemplo | No lab |
| --- | --- | --- | --- |
| `gsap.timeline({ defaults, scrollTrigger, onUpdate })` | cria a timeline | — | 04, 07–10 |
| `defaults` | valores herdados pelos filhos | `{ ease: "none", duration: 1 }` | 04, 07–10 |
| position parameter | quando cada tween começa | `">"`, `"<"`, `"-=0.5"`, `"+=1"`, `0` | 04, 07–10 |
| `tl.addLabel("nome", pos)` | marca um tempo com nome | `"video"` | 10 |
| `tl.labels` | objeto `{ nome: tempo }` | — | 10 |
| `tl.currentLabel()` | último label pelo qual o playhead passou | `"imagem"` | 10 |
| `tl.duration()` / `tl.time()` | duração total / tempo atual | `5.8` | 08 |
| `tl.getChildren()` | tweens da timeline (com `startTime()`, `duration()`) | — | 08 |
| `tl.to({}, { duration })` | "respiro": tempo sem mudança | `0.6` | 07, 10 |

### Utilitários, React e responsividade

| API | O que faz | No lab |
| --- | --- | --- |
| `gsap.utils.toArray(".sel", container)` | array de elementos com escopo | 03, 07, 09, 10 |
| `gsap.getProperty(el, "x")` | lê o valor atual de uma propriedade | 02, 04, 05 |
| `gsap.set(el, vars)` | aplica valores sem animar | 05, 08 |
| `gsap.utils.snap(array, valor)` | valor mais próximo de uma lista | (variação 09) |
| `gsap.matchMedia()` + `mm.add(condições, fn)` | configuração por media query, com revert automático | todos |
| `context.conditions` | booleanos das condições | todos |
| `useGSAP(fn, { dependencies, revertOnUpdate, scope })` | ciclo de vida + cleanup no React | todos |
| `contextSafe(fn)` | registra no contexto animações criadas depois (eventos, async) | 06 |

---

## 6. Como pensar uma animação GSAP

Um método de 14 perguntas. Responda **antes** de escrever código — cada resposta vira uma linha da configuração.

| # | Pergunta | Vira… | Dica |
| --- | --- | --- | --- |
| 1 | **Qual elemento será animado?** | o alvo do tween | Se for o mesmo elemento que precisa ser medido (trigger) ou pinado, crie um **wrapper**: um mede, o outro anima. |
| 2 | **Qual é o estado inicial?** | `from` / 1º objeto do `fromTo` | Se o estado inicial é "escondido", o CSS deve ter o estado **final** (visível) — use `from()`. |
| 3 | **Qual é o estado final?** | `to` / 2º objeto do `fromTo` | Se nenhum dos dois é o CSS, use `fromTo()`. |
| 4 | **O scroll dispara ou controla?** | `toggleActions` × `scrub` | Dispara: entradas, coisas que devem terminar sozinhas. Controla: movimentos que o usuário deve "dirigir". |
| 5 | **Qual será o trigger?** | `trigger` | Um elemento estável (não animado), cuja posição faz sentido para o efeito. |
| 6 | **Onde começa?** | `start` | Desenhe: "quando o ___ do elemento encostar no ___ da tela". |
| 7 | **Onde termina?** | `end` | Encontro (`"bottom top"`) ou distância (`"+=800"`)? Com pin, quase sempre distância. |
| 8 | **Precisa de scrub? Qual?** | `scrub` | `true` = preciso; `0.5–1` = suave; valores altos = "pesado". Use `ease: "none"`. |
| 9 | **Precisa de pin?** | `pin`, `pinSpacing`, `end` | Só se a animação precisa de tempo com o elemento **parado** na tela. Pine o container, anime filhos. |
| 10 | **Precisa de timeline?** | `gsap.timeline()` | Sim se há 2+ tweens que precisam andar juntos/em sequência sob o mesmo controle. |
| 11 | **Precisa de stagger?** | `stagger` | Sim se vários elementos iguais fazem a mesma coisa com defasagem. `each` para poucos, `amount` para muitos. |
| 12 | **Precisa de snap?** | `snap` | Só para "paradas" com significado (etapas). Nunca para conteúdo de leitura. |
| 13 | **Como fica no mobile?** | ramo `isMobile` no `matchMedia` / CSS | Distâncias proporcionais, alturas em `svh`, medidas em vez de números fixos, toque = scroll nativo. |
| 14 | **E com movimento reduzido?** | ramo `reduceMotion` | Conteúdo completo e legível sem animação; vídeos com controles; nada escondido. |

**Fluxo de decisão rápido:**

```
O movimento é uma ENTRADA (aparece e pronto)?
 ├─ sim → gsap.from() + toggleActions (ex. 01). Vários itens? stagger (ex. 03) ou batch.
 └─ não → o usuário deve CONTROLAR o movimento?
          ├─ sim → scrub. O elemento precisa ficar PARADO na tela durante o efeito?
          │        ├─ sim → pin + timeline + end "+=…" (ex. 07, 08, 09). Tem etapas? snap + labels (ex. 10).
          │        └─ não → tween com scrub, start "top bottom" / end "bottom top" (ex. 02, 04, 05).
          └─ não → provavelmente não é uma animação de scroll (hover, clique, timeline normal).
```

**Ficha para copiar** (cole no topo do `animation.ts` de um exemplo novo):

```
ALVO ..................  (quem anima?)          TRIGGER ........ (quem é medido?)
INICIAL ...............  FINAL ..............     MÉTODO: from | to | fromTo | timeline
SCROLL: dispara | controla      START "___ ___"   END "___ ___" | "+=___"
SCRUB: não | true | ___s        PIN: não | sim (pinSpacing ___)   SNAP: não | ___
STAGGER: não | each/amount ___ from ___
MOBILE: ...............         REDUCED MOTION: ...............
```

**Exemplo de uso do método:** *"quero que o logo gire e encolha enquanto o header fica preso no topo".*
1 alvo: o `<img>` do logo · 2 inicial: `rotation: 0, scale: 1` · 3 final: `rotation: 360, scale: 0.5` · 4 controla · 5 trigger: o header · 6 start `"top top"` · 7 end `"+=600"` · 8 `scrub: 0.5` · 9 pin: sim, o **header** (o logo é filho: pode animar) · 10 timeline: não (um tween) · 11 não · 12 não · 13 mobile: `end: "+=300"` · 14 reduzido: sem rotação, só o header estático.

```ts
gsap.to(logo, { rotation: 360, scale: 0.5, ease: "none",
  scrollTrigger: { trigger: header, pin: true, start: "top top", end: isMobile ? "+=300" : "+=600", scrub: 0.5 } });
```

---

## 7. Criando uma animação do zero: exemplo 11 passo a passo

Vamos criar **"11 — Contador de números"**: um número vai de 0 a 1.250 e uma barra enche conforme você rola. Conceito novo: **animar um objeto JavaScript comum** (não um elemento) e escrever o resultado no DOM no `onUpdate`.

**Passo 1 — método:** alvo: um objeto `{ value: 0 }` (e a barra) · inicial 0 · final 1250 · controla · trigger: o bloco · start `"top 80%"` · end `"top 30%"` · `scrub: true` · sem pin · timeline: sim (número + barra juntos) · sem stagger/snap · mobile: igual · reduzido: mostrar 1.250 direto.

**Passo 2 — pasta:** crie `src/examples/example11-counter/`.

**Passo 3 — `animation.ts`:**

```ts
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

export type CounterParams = { target: number; start: string; end: string; scrub: boolean | number; markers: boolean };

export const COUNTER_DEFAULTS: CounterParams = {
  target: 1250,
  start: "top 80%",
  end: "top 30%",
  scrub: true,
  markers: DEBUG_SCROLL,
};

export type CounterElements = { trigger: HTMLElement; output: HTMLElement; bar: HTMLElement };

export function createCounter(el: CounterElements, params: CounterParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    const format = (n: number) => Math.round(n).toLocaleString("pt-BR");

    if (reduceMotion) {
      el.output.textContent = format(params.target); // valor final, sem animação
      return;
    }

    // O GSAP anima QUALQUER propriedade numérica de QUALQUER objeto.
    const counter = { value: 0 };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "11-counter",
        trigger: el.trigger,
        start: params.start,
        end: params.end,
        scrub: params.scrub,
        markers: params.markers,
      },
    });

    tl.to(counter, { value: params.target, onUpdate: () => { el.output.textContent = format(counter.value); } }, 0)
      .fromTo(el.bar, { scaleX: 0 }, { scaleX: 1 }, 0);
  });

  return mm;
}
```

**Passo 4 — `Example11Counter.tsx`:**

```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { END_SUGGESTIONS, SCRUB_OPTIONS, START_SUGGESTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { COUNTER_DEFAULTS, createCounter, type CounterParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CONTROLS: Control<CounterParams>[] = [
  { type: "range", key: "target", label: "valor final", group: "tween", min: 100, max: 10000, step: 50 },
  { type: "text", key: "start", label: "start", group: "scrollTrigger", suggestions: START_SUGGESTIONS },
  { type: "text", key: "end", label: "end", group: "scrollTrigger", suggestions: END_SUGGESTIONS },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: CounterParams) {
  return `const counter = { value: 0 };
gsap.timeline({ scrollTrigger: { trigger: block, start: "${p.start}", end: "${p.end}", scrub: ${p.scrub} } })
  .to(counter, { value: ${p.target}, ease: "none", onUpdate: render }, 0)
  .fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);`;
}

export function Example11Counter({ meta }: ExampleProps) {
  const lab = useLabParams(COUNTER_DEFAULTS);
  const triggerRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = createCounter(
        { trigger: triggerRef.current!, output: outputRef.current!, bar: barRef.current! },
        lab.params,
      );
      return () => mm.revert();
    },
    { dependencies: [lab.params, lab.runId], revertOnUpdate: true },
  );

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(lab.params)}
      source={source}
      summary={[["valor", String(lab.params.target)], ["start", lab.params.start], ["end", lab.params.end]]}
    >
      <div className="ct-stage wrap">
        <div className="ct-block is-trigger" ref={triggerRef} data-label="trigger">
          <span className="ct-number" ref={outputRef}>0</span>
          <span className="ct-bar">
            <span className="ct-bar__fill" ref={barRef} />
          </span>
        </div>
      </div>
    </AnimationSection>
  );
}
```

**Passo 5 — `styles.css`:**

```css
.ct-stage { padding-block: 50vh; }
.ct-block { display: grid; gap: 24px; padding: 48px; border-radius: var(--radius); background: var(--bg-1); }
.ct-number { font-size: clamp(4rem, 14vw, 12rem); font-weight: 700; font-variant-numeric: tabular-nums; }
.ct-bar { height: 6px; border-radius: 99px; background: var(--bg-3); overflow: hidden; }
.ct-bar__fill { display: block; height: 100%; background: var(--accent); transform-origin: left center; }
```

**Passo 6 — `index.ts`:**

```ts
import type { LabExample } from "../../lab/types";
import { Example11Counter } from "./Example11Counter";

export const example11: LabExample = {
  meta: {
    number: "11",
    title: "Contador de números",
    summary: "Um objeto JavaScript comum ({ value: 0 }) animado pelo scroll; o onUpdate escreve o número no DOM.",
    categories: ["texto"],
    concepts: ["objeto JS como alvo", "onUpdate", "scrub", "timeline", "scaleX"],
    observe: ["Role devagar: o número acompanha exatamente o scroll.", "Troque scrub para 1: o número “desliza”."],
    sourcePath: "src/examples/example11-counter/animation.ts",
  },
  Component: Example11Counter,
};
```

**Passo 7 — registrar** em `src/lab/registry.ts`:

```ts
import { example11 } from "../examples/example11-counter";
export const EXAMPLES: LabExample[] = [example01, /* … */ example10, example11];
```

**Passo 8 — verificar:** `npm run dev`, ligue markers no painel, role nos dois sentidos, mude o `end`, redimensione a janela, teste com movimento reduzido emulado. Depois `npm run build` para o type-check.

> Estes arquivos foram compilados com `tsc` junto do projeto antes de entrarem aqui no tutorial.

---

## 8. Problemas comuns (checklist)

Antes de dizer "o ScrollTrigger está bugado", confira:

- [ ] Plugin registrado (`gsap.registerPlugin(ScrollTrigger)`) antes de criar animações?
- [ ] Ligou os **markers**? start/end estão onde você imagina?
- [ ] O **trigger** é um elemento estável (não animado)?
- [ ] Está animando o **elemento pinado**? Anime um filho.
- [ ] Algum **ancestral** do pinado tem `transform`, `filter` ou `will-change`?
- [ ] Os ScrollTriggers são criados **na ordem da página**? (Senão: `refreshPriority` / `ScrollTrigger.sort()`.)
- [ ] Imagens/vídeos têm **dimensões reservadas** (`width/height` ou `aspect-ratio`)? Fontes carregando depois? → `ScrollTrigger.refresh()`.
- [ ] Algum valor depende do tamanho da tela? Use **função** + `invalidateOnRefresh: true`.
- [ ] `scroll-behavior: smooth` no `html`? Remova.
- [ ] Está usando `scrub` **e** esperando `toggleActions`? Um exclui o outro.
- [ ] Um ScrollTrigger para **vários** elementos que deveriam animar separadamente? Um por elemento, ou `batch`.
- [ ] `scrollTrigger` dentro de tweens **filhos** de uma timeline? Coloque na timeline.
- [ ] Dois tweens na **mesma propriedade** do mesmo elemento sobrepostos?
- [ ] Animação "longa demais/curta demais" com scrub? Ajuste a **distância** (`end`), não a `duration`.
- [ ] React: está usando `useGSAP` (ou `gsap.context()` + `revert()`)? Animações criadas em eventos/async passam por `contextSafe`?
- [ ] Vídeo: esperou o **metadata**? Keyframes densos? `muted` + `playsInline`?
- [ ] Mobile: `100svh`, distâncias proporcionais, `ignoreMobileResize`?
- [ ] Movimento reduzido: o conteúdo fica completo e legível sem animação?
- [ ] Scroll horizontal involuntário? `overflow-x: clip` no container que transborda.

---

## 9. Referências oficiais

**GSAP (core)**
- Documentação: https://gsap.com/docs/v3/
- `gsap.to()`: https://gsap.com/docs/v3/GSAP/gsap.to()
- `gsap.from()`: https://gsap.com/docs/v3/GSAP/gsap.from()
- `gsap.fromTo()`: https://gsap.com/docs/v3/GSAP/gsap.fromTo()
- `gsap.set()`: https://gsap.com/docs/v3/GSAP/gsap.set()
- Tween: https://gsap.com/docs/v3/GSAP/Tween
- CSS (transforms, autoAlpha, xPercent…): https://gsap.com/docs/v3/GSAP/CorePlugins/CSS
- Eases: https://gsap.com/docs/v3/Eases
- Staggers: https://gsap.com/resources/getting-started/Staggers
- `gsap.getProperty()`: https://gsap.com/docs/v3/GSAP/gsap.getProperty()
- `gsap.utils.toArray()`: https://gsap.com/docs/v3/GSAP/UtilityMethods/toArray()
- `gsap.utils.snap()`: https://gsap.com/docs/v3/GSAP/UtilityMethods/snap()
- `gsap.matchMedia()`: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()
- `gsap.context()`: https://gsap.com/docs/v3/GSAP/gsap.context()
- Erros comuns de GSAP: https://gsap.com/resources/mistakes/

**Timeline**
- `gsap.timeline()`: https://gsap.com/docs/v3/GSAP/gsap.timeline()
- Timeline: https://gsap.com/docs/v3/GSAP/Timeline
- Position parameter: https://gsap.com/resources/position-parameter/
- `addLabel()`: https://gsap.com/docs/v3/GSAP/Timeline/addLabel()
- `currentLabel()`: https://gsap.com/docs/v3/GSAP/Timeline/currentLabel()
- `getChildren()`: https://gsap.com/docs/v3/GSAP/Timeline/getChildren()

**ScrollTrigger** (trigger, start, end, scrub, pin, pinSpacing, snap, toggleActions e callbacks estão todos na página principal)
- ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Erros comuns de ScrollTrigger: https://gsap.com/resources/st-mistakes/
- `ScrollTrigger.create()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.create()
- `ScrollTrigger.refresh()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.refresh()
- `ScrollTrigger.sort()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.sort()
- `ScrollTrigger.config()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()
- `ScrollTrigger.batch()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.batch()
- `labelToScroll()`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/labelToScroll()

**React**
- GSAP + React (`useGSAP`, `contextSafe`): https://gsap.com/resources/React/

**Outros plugins citados**
- SplitText: https://gsap.com/docs/v3/Plugins/SplitText/

