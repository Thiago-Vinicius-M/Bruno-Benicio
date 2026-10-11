/** Valores dos modelos de show, em reais (numeric(10,2) no banco). */

export const MAX_PRICE = 99_999_999.99;

/** 1500 → "R$ 1.500,00" (padrão brasileiro, sempre com centavos). */
export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Centavos inteiros: compara valores sem erro de ponto flutuante. */
export const toCents = (value: number) => Math.round(value * 100);

/**
 * Valor digitado no painel → número. Aceita "1500", "1.500", "1.500,00", "1500,5",
 * "1500.50" e "R$ 1.500,00". Ponto seguido de 3 dígitos é separador de milhar
 * (convenção brasileira). Inválido, zero, negativo ou com mais de 2 casas → null.
 */
export function parsePrice(raw: string | number | null | undefined): number | null {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else {
    const text = (raw ?? "").replace(/R\$/i, "").replace(/\s/g, "");
    if (!/^\d[\d.,]*$/.test(text)) return null;

    if (text.includes(",")) {
      const parts = text.split(",");
      if (parts.length !== 2) return null;
      const [integer, decimals] = parts;
      if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(integer) || !/^\d{1,2}$/.test(decimals)) return null;
      value = Number(`${integer.replace(/\./g, "")}.${decimals}`);
    } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      value = Number(text.replace(/\./g, ""));
    } else if (/^\d+(\.\d{1,2})?$/.test(text)) {
      value = Number(text);
    } else {
      return null;
    }
  }

  if (!Number.isFinite(value) || value <= 0 || value > MAX_PRICE) return null;
  if (Math.abs(toCents(value) - value * 100) > 1e-6) return null;
  return toCents(value) / 100;
}

/** Valor salvo → texto do campo do painel ("1500.5" → "1.500,50"). */
export const priceInputValue = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
