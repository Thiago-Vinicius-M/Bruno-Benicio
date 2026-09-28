/**
 * ============================================================================
 * DEBUG GLOBAL DOS SCROLLTRIGGERS
 * ============================================================================
 *
 * `true`  → todos os exemplos começam com `markers: true`
 * `false` → todos os exemplos começam com `markers: false`
 *
 * Os markers desenham na tela:
 *  - "start" / "end"                  → posições calculadas no ELEMENTO trigger
 *  - "scroller-start" / "scroller-end" → posições na VIEWPORT (fixas na tela)
 *
 * A animação começa quando "start" encosta em "scroller-start" e termina
 * quando "end" encosta em "scroller-end". Cada ScrollTrigger do lab tem um
 * `id` (ex.: "01-fade-slide"), que aparece no texto do marker para você saber
 * a qual exemplo ele pertence.
 *
 * Por que o padrão é `false`: com os 10 exemplos ligados, são ~20 marcadores
 * "scroller-start/end" fixos na borda direita da tela ao mesmo tempo, um em
 * cima do outro. Na prática é mais útil ligar só o exemplo que você está
 * estudando — cada painel de parâmetros tem uma checkbox "markers" para isso.
 * Mude para `true` quando quiser ver todos de uma vez.
 */
export const DEBUG_SCROLL = false;
