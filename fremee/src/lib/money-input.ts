/** «1.234,5» / «12,50» / «12.5» → número con dos decimales, o null si no es un importe. */
export function parseAmount(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace("€", "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100) / 100;
}

/** 86.4 → «86,40» para un campo de texto. */
export const toInputText = (value: number) => value.toFixed(2).replace(".", ",");
