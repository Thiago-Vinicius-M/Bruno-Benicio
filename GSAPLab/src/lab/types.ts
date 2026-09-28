/**
 * Tipos da "moldura" do laboratório (UI). Nada aqui anima nada: estes tipos
 * descrevem os metadados de cada exemplo e os controles do painel.
 */
import type { ComponentType } from "react";

export type Category = "texto" | "imagem" | "vídeo";

export type ExampleMeta = {
  /** "01", "02"... usado no título, na navegação e no id da seção (#example-01) */
  number: string;
  title: string;
  /** Explicação curta exibida no topo da seção */
  summary: string;
  categories: Category[];
  /** Conceitos/APIs estudados (chips) */
  concepts: string[];
  /** Lista "O que observar" — o que prestar atenção enquanto rola */
  observe: string[];
  /** Caminho do arquivo de animação, exibido acima do código-fonte */
  sourcePath: string;
};

export type ExampleProps = { meta: ExampleMeta };

export type LabExample = {
  meta: ExampleMeta;
  Component: ComponentType<ExampleProps>;
};

/* ---------------------------------------------------------------------------
 * Controles do painel de parâmetros
 * ------------------------------------------------------------------------- */

export type Primitive = string | number | boolean;

export type ControlOption = { label: string; value: Primitive };

/**
 * Em qual "lugar" do código GSAP o parâmetro vive. O painel agrupa os
 * controles por grupo — assim você enxerga que `start` pertence ao objeto
 * `scrollTrigger`, que `ease` pertence ao tween, etc.
 */
export type ControlGroup = "scrollTrigger" | "tween" | "timeline" | "stagger" | "layout" | "debug";

type BaseControl<P> = {
  key: keyof P & string;
  label: string;
  group: ControlGroup;
  hint?: string;
  /** Desabilita o controle dependendo de outros parâmetros */
  disabled?: (params: P) => boolean;
};

export type Control<P> =
  | (BaseControl<P> & { type: "range"; min: number; max: number; step: number; unit?: string })
  | (BaseControl<P> & { type: "select"; options: ControlOption[] })
  | (BaseControl<P> & { type: "toggle" })
  | (BaseControl<P> & { type: "text"; suggestions?: string[] });

/** Pares [rótulo, valor] exibidos na barra recolhida do painel */
export type SummaryItem = [label: string, value: string];
