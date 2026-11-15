/** Text for comparing: no accents, lower case («Lucía» → «lucia»). */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Whether `text` contains `query`, ignoring accents and case. */
export function matchesText(text: string, query: string): boolean {
  const q = foldText(query.trim());
  return q.length > 0 && foldText(text).includes(q);
}

/**
 * Splits `text` around the first match of `query` (ignoring accents and case) so the match can be
 * drawn in bold: «Lucía», «lu» → [{text: "Lu", hit: true}, {text: "cía", hit: false}].
 * Folds character by character, so positions map back to the original text.
 */
export function highlightParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const q = foldText(query.trim());
  if (!q) return [{ text, hit: false }];
  const chars = Array.from(text);
  const folded = chars.map(foldText);
  const flat = folded.join("");
  const at = flat.indexOf(q);
  if (at < 0) return [{ text, hit: false }];
  // Back from positions in the folded text to character indexes in the original.
  let pos = 0;
  let start = -1;
  let end = chars.length;
  for (let i = 0; i < chars.length; i++) {
    if (start < 0 && pos + folded[i].length > at) start = i;
    pos += folded[i].length;
    if (start >= 0 && pos >= at + q.length) { end = i + 1; break; }
  }
  const parts = [
    { text: chars.slice(0, start).join(""), hit: false },
    { text: chars.slice(start, end).join(""), hit: true },
    { text: chars.slice(end).join(""), hit: false },
  ];
  return parts.filter((p) => p.text);
}
