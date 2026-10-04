/**
 * Sinal "página pronta" — liga a tela de loading à entrada do Hero sem acoplar os dois.
 *
 * O Loader chama `markPageReady()` quando começa a sair; quem depende disso (ex.: a entrada
 * do Hero) se inscreve com `onPageReady()`. O estado vive no módulo, então dura a sessão
 * inteira: ao voltar para a página por navegação client-side, o loading não aparece de
 * novo e as inscrições disparam na hora.
 *
 * Só é alterado em efeitos do navegador — no servidor continua sempre `false`.
 */
let ready = false;
const listeners = new Set<() => void>();

export function isPageReady() {
  return ready;
}

export function markPageReady() {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
  listeners.clear();
}

/** Executa `listener` quando a página ficar pronta (na hora, se já estiver). Retorna o cancelamento. */
export function onPageReady(listener: () => void): () => void {
  if (ready) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Só para testes: volta ao estado inicial. */
export function resetPageReady() {
  ready = false;
  listeners.clear();
}

/**
 * Espera o que a primeira dobra precisa para aparecer pronta: fontes (next/font) e imagens
 * que não são lazy (logo e foto do Hero, logo do loading), já decodificadas — sem esperar
 * iframes, vídeos ou imagens lazy, que não aparecem de início.
 * `maxWaitMs` é um teto de segurança: o loading nunca fica preso numa rede lenta.
 */
export function waitForPageResources(maxWaitMs: number): Promise<void> {
  const images = Array.from(document.images).filter((img) => img.loading !== "lazy");
  const resources = Promise.all([
    document.fonts?.ready,
    ...images.map((img) => img.decode?.().catch(() => undefined)),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs));
  return Promise.race([resources, timeout]);
}
