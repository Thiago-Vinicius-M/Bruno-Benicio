import type { GalleryVideo, VideoOrientation } from "./types";

/**
 * Composição automática da galeria: divide a lista em linhas, NA ORDEM da lista, escolhendo
 * a combinação que deixa todos os vídeos num tamanho confortável e aproveita a largura.
 *
 * Cada linha é "justificada": as colunas têm largura proporcional ao formato de cada card
 * (16:9 ou 9:16), então todos os cards da linha ficam com a mesma altura e a linha fecha
 * a largura inteira, sem buracos. Dois horizontais seguidos podem virar uma PILHA (um
 * em cima do outro), que ocupa uma coluna e se comporta como um card de formato ~8:9 —
 * é o que permite, por exemplo, vertical · (horizontal / horizontal) · vertical.
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
  maxRowHeight: 0.5,
  /**
   * teto das linhas de secundários abaixo de um principal horizontal (60% da linha dele):
   * os secundários complementam o destaque sem disputar com ele
   */
  subordinateRowHeight: 0.3,
  /** horizontal confortável: pelo menos ~42% da largura (≈ 450px no desktop) */
  minLandscapeWidth: 0.42,
  /** vertical confortável: pelo menos ~40% da largura de altura (≈ 430px no desktop) */
  minPortraitHeight: 0.4,
  maxUnitsPerRow: 4,
  /** pesos do custo de cada linha */
  weights: { size: 1, emptySpace: 1, stack: 0.02, lonely: 0.05 },
} as const;

export type LayoutUnit =
  | { kind: "single"; video: GalleryVideo }
  | { kind: "stack"; videos: [GalleryVideo, GalleryVideo] };

export type GalleryRow = {
  units: LayoutUnit[];
  /** soma das proporções (largura/altura) das colunas — define a altura da linha */
  aspect: number;
  /** teto de altura da linha, se diferente de LAYOUT.maxRowHeight (CSS: --row-scale) */
  maxHeight?: number;
};

/** Proporção (largura/altura) da coluna ocupada pela unidade. */
export const unitAspect = (unit: LayoutUnit) => (unit.kind === "stack" ? STACK_ASPECT : ASPECT[unit.video.orientation]);

export const unitVideos = (unit: LayoutUnit) => (unit.kind === "stack" ? unit.videos : [unit.video]);

/** Altura natural da linha (fração da largura) e a altura que ela terá de fato (com o teto). */
export function rowGeometry(units: LayoutUnit[], maxHeight: number = LAYOUT.maxRowHeight) {
  const aspect = units.reduce((sum, unit) => sum + unitAspect(unit), 0);
  const gaps = (units.length - 1) * LAYOUT.gap;
  const naturalHeight = (1 - gaps) / aspect;
  const height = Math.min(naturalHeight, maxHeight);
  return { aspect, height, fill: height * aspect + gaps };
}

/** Quanto falta para o tamanho confortável (0 = confortável); escala logarítmica. */
const shortfall = (comfortable: number, actual: number) => (actual >= comfortable ? 0 : Math.log(comfortable / actual) ** 2);

/** Custo de uma linha: cards pequenos demais, largura sobrando, pilhas e linhas de um card só. */
export function rowCost(units: LayoutUnit[], totalVideos: number, maxHeight: number = LAYOUT.maxRowHeight) {
  const { height, fill } = rowGeometry(units, maxHeight);
  const { weights } = LAYOUT;
  let cost = weights.emptySpace * (1 - fill) ** 2;

  for (const unit of units) {
    if (unit.kind === "stack") {
      const itemHeight = (height - LAYOUT.gap) / 2;
      cost += 2 * weights.size * shortfall(LAYOUT.minLandscapeWidth, itemHeight * ASPECT.landscape);
      cost += weights.stack;
    } else if (unit.video.orientation === "landscape") {
      cost += weights.size * shortfall(LAYOUT.minLandscapeWidth, height * ASPECT.landscape);
    } else {
      cost += weights.size * shortfall(LAYOUT.minPortraitHeight, height);
    }
  }

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
export function buildGalleryRows(videos: GalleryVideo[], maxHeight: number = LAYOUT.maxRowHeight): GalleryRow[] {
  const n = videos.length;
  const best: { cost: number; row: LayoutUnit[] | null }[] = Array.from({ length: n + 1 }, () => ({
    cost: Infinity,
    row: null,
  }));
  best[n] = { cost: 0, row: null };

  for (let start = n - 1; start >= 0; start--) {
    for (const units of candidateRows(videos, start)) {
      const cost = rowCost(units, n, maxHeight) + best[start + consumed(units)].cost;
      // `<` mantém a primeira candidata em empates: linhas mais curtas e sem pilha primeiro.
      if (cost < best[start].cost - 1e-9) best[start] = { cost, row: units };
    }
  }

  const rows: GalleryRow[] = [];
  for (let start = 0; start < n; ) {
    const units = best[start].row!;
    const row: GalleryRow = { units, aspect: rowGeometry(units).aspect };
    if (maxHeight !== LAYOUT.maxRowHeight) row.maxHeight = maxHeight;
    rows.push(row);
    start += consumed(units);
  }
  return rows;
}

/**
 * Home com vídeo principal (`leadId`, sempre o primeiro da lista). A composição segue a
 * orientação dele, preservando a proporção:
 *   horizontal → linha própria, na largura toda; os secundários vêm abaixo em linhas com
 *                teto menor (LAYOUT.subordinateRowHeight), sem disputar o destaque;
 *   vertical   → entra na composição normal como primeira coluna: ocupa a altura inteira
 *                da linha e os secundários se organizam ao lado (ex.: vertical · pilha de
 *                dois horizontais) ou nas linhas seguintes, conforme o espaço.
 * Sem principal, é a galeria comum.
 */
export function buildLeadRows(videos: GalleryVideo[], leadId?: string): GalleryRow[] {
  const [lead, ...rest] = videos;
  if (!lead || lead.id !== leadId || lead.orientation !== "landscape") return buildGalleryRows(videos);
  const units: LayoutUnit[] = [{ kind: "single", video: lead }];
  return [{ units, aspect: rowGeometry(units).aspect }, ...buildGalleryRows(rest, LAYOUT.subordinateRowHeight)];
}
