import type { GalleryVideo, VideoOrientation } from "./types";

/**
 * Composição automática da galeria: divide a lista em linhas, NA ORDEM da lista, escolhendo
 * a combinação que deixa todos os vídeos num tamanho confortável e aproveita a largura.
 *
 * Em geral a linha é "justificada": as colunas têm largura proporcional ao formato de cada
 * card (16:9 ou 9:16), então todos os cards da linha ficam com a mesma altura e a linha
 * fecha a largura inteira, sem buracos. Dois horizontais seguidos podem virar uma PILHA (um
 * em cima do outro), que ocupa uma coluna e se comporta como um card de formato ~8:9 —
 * é o que permite, por exemplo, vertical · (horizontal / horizontal) · vertical.
 *
 * Vertical e horizontal soltos na mesma linha: o vertical não encolhe para o horizontal
 * caber. A linha cresce até a altura confortável do vertical e o horizontal fica com o
 * resto da largura, mais baixo que a linha e centralizado na altura dela.
 *
 * Medidas em frações da largura da galeria (1 = largura inteira), para valer em qualquer
 * tela a partir do tablet. No celular o CSS empilha tudo numa coluna.
 */

export const ASPECT: Record<VideoOrientation, number> = { landscape: 16 / 9, portrait: 9 / 16 };

/** Pilha de dois horizontais: largura w, altura 2 · w · 9/16. */
const STACK_ASPECT = 1 / (2 * (9 / 16));

export const LAYOUT = {
  /** espaço entre cards (≈ 20px numa galeria de 1080px) */
  gap: 0.02,
  /** altura máxima de uma linha; acima disso a linha encolhe e centraliza (CSS: --gallery-row-max) */
  maxRowHeight: 0.6,
  /**
   * teto das linhas de secundários abaixo do principal: os secundários complementam o
   * destaque sem disputar com ele. Linha com vertical: teto maior, senão o vertical fica
   * pequeno demais (a largura dele é só 9/16 da altura)
   */
  subordinateRowHeight: { landscape: 0.3, portrait: 0.45 },
  /**
   * altura do bloco do principal (CSS: --gallery-lead-*-max, que também limita pela altura
   * da tela): horizontal → largura inteira (9/16); vertical → bem mais alto que qualquer
   * secundário, sem esticar (a largura sai da proporção 9:16)
   */
  leadHeight: { landscape: 9 / 16, portrait: 0.8 },
  /** horizontal confortável: pelo menos ~42% da largura (≈ 450px no desktop) */
  minLandscapeWidth: 0.42,
  /**
   * vertical confortável: pelo menos ~55% da largura de altura (≈ 590px no desktop); é até
   * onde a linha mista cresce (sem passar do teto dela)
   */
  minPortraitHeight: 0.55,
  maxUnitsPerRow: 4,
  /** pesos do custo de cada linha (offset: horizontal mais baixo que a linha mista) */
  weights: { size: 1, emptySpace: 1, stack: 0.02, lonely: 0.05, offset: 0.05 },
} as const;

export type LayoutUnit =
  | { kind: "single"; video: GalleryVideo }
  | { kind: "stack"; videos: [GalleryVideo, GalleryVideo] };

/** Teto de altura das linhas: um número, ou um para linhas só de horizontais e outro para linhas com vertical. */
export type RowCap = number | Readonly<Record<VideoOrientation, number>>;

export type GalleryRow = {
  units: LayoutUnit[];
  /** largura das colunas ÷ altura da linha (sem os espaços) — define a altura da linha */
  aspect: number;
  /** largura de cada coluna, em frações que somam 1 (CSS: --row-columns) */
  columns: number[];
  /** teto de altura da linha, se diferente de LAYOUT.maxRowHeight (CSS: --row-scale) */
  maxHeight?: number;
  /** linha própria do vídeo principal (orientação dele) */
  lead?: VideoOrientation;
};

/** Proporção (largura/altura) da coluna ocupada pela unidade. */
export const unitAspect = (unit: LayoutUnit) => (unit.kind === "stack" ? STACK_ASPECT : ASPECT[unit.video.orientation]);

export const unitVideos = (unit: LayoutUnit) => (unit.kind === "stack" ? unit.videos : [unit.video]);

const isSingle = (unit: LayoutUnit, orientation: VideoOrientation) =>
  unit.kind === "single" && unit.video.orientation === orientation;

/** Altura confortável do vertical numa linha com este teto. */
const portraitTarget = (maxHeight: number) => Math.min(LAYOUT.minPortraitHeight, maxHeight);

/**
 * Geometria da linha, em frações da largura da galeria: altura (a dos verticais e pilhas),
 * largura de cada coluna e quanto da largura a linha ocupa.
 *
 * Justificada, a altura é a natural (todos iguais, fechando a largura) até o teto. Com
 * vertical e horizontal solto na mesma linha, ela cresce até a altura confortável do
 * vertical enquanto os horizontais mantiverem a largura confortável; eles ficam com o
 * resto da largura (mais baixos que a linha).
 */
export function rowGeometry(units: LayoutUnit[], maxHeight: number = LAYOUT.maxRowHeight) {
  const gaps = (units.length - 1) * LAYOUT.gap;
  const justified = Math.min((1 - gaps) / units.reduce((sum, unit) => sum + unitAspect(unit), 0), maxHeight);
  const loose = units.filter((unit) => isSingle(unit, "landscape")).length;
  // proporção das colunas que acompanham a altura da linha (verticais e pilhas)
  const tallAspect = units.reduce((sum, unit) => sum + (isSingle(unit, "landscape") ? 0 : unitAspect(unit)), 0);

  let height = justified;
  if (loose && units.some((unit) => isSingle(unit, "portrait"))) {
    const roomForLandscapes = (1 - gaps - loose * LAYOUT.minLandscapeWidth) / tallAspect;
    height = Math.max(justified, Math.min(portraitTarget(maxHeight), roomForLandscapes));
  }

  // acima da altura justificada (que então não bateu no teto), os horizontais dividem o resto da largura
  const landscapeWidth = height > justified ? (1 - gaps - height * tallAspect) / loose : height * ASPECT.landscape;
  const widths = units.map((unit) => (isSingle(unit, "landscape") ? landscapeWidth : height * unitAspect(unit)));
  const width = widths.reduce((sum, value) => sum + value, 0);
  return { height, widths, aspect: width / height, fill: width + gaps };
}

/** Quanto falta para o tamanho confortável (0 = confortável); escala logarítmica. */
const shortfall = (comfortable: number, actual: number) => (actual >= comfortable ? 0 : Math.log(comfortable / actual) ** 2);

/** Custo de uma linha: cards pequenos demais, largura sobrando, pilhas e linhas de um card só. */
export function rowCost(units: LayoutUnit[], totalVideos: number, maxHeight: number = LAYOUT.maxRowHeight) {
  const { height, widths, fill } = rowGeometry(units, maxHeight);
  const { weights } = LAYOUT;
  let cost = weights.emptySpace * (1 - fill) ** 2;

  units.forEach((unit, index) => {
    if (unit.kind === "stack") {
      const itemHeight = (height - LAYOUT.gap) / 2;
      cost += 2 * weights.size * shortfall(LAYOUT.minLandscapeWidth, itemHeight * ASPECT.landscape);
      cost += weights.stack;
    } else if (unit.video.orientation === "landscape") {
      cost += weights.size * shortfall(LAYOUT.minLandscapeWidth, widths[index]);
      cost += weights.offset * (1 - widths[index] / ASPECT.landscape / height);
    } else {
      cost += weights.size * shortfall(portraitTarget(maxHeight), height);
    }
  });

  if (units.length === 1 && totalVideos > 1) cost += weights.lonely;
  return cost;
}

/** Todas as linhas possíveis começando em `start` (respeitando a ordem da lista). */
function candidateRows(videos: GalleryVideo[], start: number): LayoutUnit[][] {
  const rows: LayoutUnit[][] = [];

  const extend = (index: number, units: LayoutUnit[]) => {
    // Uma pilha sozinha (ou só pilhas) não tem altura de referência: a linha precisa de um card inteiro.
    if (units.length && units.some((unit) => unit.kind === "single")) rows.push(units);
    if (units.length === LAYOUT.maxUnitsPerRow || index >= videos.length) return;

    extend(index + 1, [...units, { kind: "single", video: videos[index] }]);
    const next = videos[index + 1];
    if (videos[index].orientation === "landscape" && next?.orientation === "landscape") {
      extend(index + 2, [...units, { kind: "stack", videos: [videos[index], next] }]);
    }
  };

  extend(start, []);
  return rows;
}

const consumed = (units: LayoutUnit[]) => units.reduce((sum, unit) => sum + unitVideos(unit).length, 0);

/**
 * Divide os vídeos em linhas com o menor custo total (programação dinâmica sobre a lista).
 * A ordem é sempre a da lista: o que o painel define é o que aparece, da esquerda para a
 * direita e de cima para baixo.
 */
export function buildGalleryRows(videos: GalleryVideo[], cap: RowCap = LAYOUT.maxRowHeight): GalleryRow[] {
  const capFor = (units: LayoutUnit[]) =>
    typeof cap === "number" ? cap : cap[units.some((unit) => isSingle(unit, "portrait")) ? "portrait" : "landscape"];
  const n = videos.length;
  const best: { cost: number; row: LayoutUnit[] | null }[] = Array.from({ length: n + 1 }, () => ({
    cost: Infinity,
    row: null,
  }));
  best[n] = { cost: 0, row: null };

  for (let start = n - 1; start >= 0; start--) {
    for (const units of candidateRows(videos, start)) {
      const cost = rowCost(units, n, capFor(units)) + best[start + consumed(units)].cost;
      // `<` mantém a primeira candidata em empates: linhas mais curtas e sem pilha primeiro.
      if (cost < best[start].cost - 1e-9) best[start] = { cost, row: units };
    }
  }

  const rows: GalleryRow[] = [];
  for (let start = 0; start < n; ) {
    const units = best[start].row!;
    rows.push(toRow(units, capFor(units)));
    start += consumed(units);
  }
  return rows;
}

function toRow(units: LayoutUnit[], maxHeight: number): GalleryRow {
  const { aspect, widths } = rowGeometry(units, maxHeight);
  const width = widths.reduce((sum, value) => sum + value, 0);
  const row: GalleryRow = { units, aspect, columns: widths.map((value) => value / width) };
  if (maxHeight !== LAYOUT.maxRowHeight) row.maxHeight = maxHeight;
  return row;
}

/**
 * Home com vídeo principal (`leadId`, sempre o primeiro da lista). A composição segue a
 * orientação dele, preservando a proporção. Nos dois casos ele fica sozinho na primeira
 * linha (bloco próprio, LAYOUT.leadHeight) e os secundários vêm abaixo em linhas com teto
 * menor (LAYOUT.subordinateRowHeight) — nunca ao lado dele:
 *   horizontal → largura toda da galeria;
 *   vertical   → bem mais alto que os secundários, centralizado, sem esticar.
 * Sem principal, é a galeria comum.
 */
export function buildLeadRows(videos: GalleryVideo[], leadId?: string): GalleryRow[] {
  const [lead, ...rest] = videos;
  if (!lead || lead.id !== leadId) return buildGalleryRows(videos);
  const leadRow = toRow([{ kind: "single", video: lead }], LAYOUT.leadHeight[lead.orientation]);
  return [{ ...leadRow, lead: lead.orientation }, ...buildGalleryRows(rest, LAYOUT.subordinateRowHeight)];
}
