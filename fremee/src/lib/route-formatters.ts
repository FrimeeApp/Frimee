const ROUTE_NUMBER_PATTERN = "\\d+(?:[.,]\\d+)?";

export function formatCompactRouteDuration(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) return "";

  const lower = text.toLowerCase();
  if (/^(menos de|less than)\s+1\s+(min|minute|minuto)/i.test(lower)) return "< 1 min";

  const parts = Array.from(
    lower.matchAll(
      new RegExp(
        `(${ROUTE_NUMBER_PATTERN})\\s*(d[ií]as?|days?|h(?:oras?|ours?|rs?)?|horas?|hours?|hrs?|min(?:utos?|utes?|s?)?)`,
        "gi",
      ),
    ),
  ).map((match) => {
    const amount = match[1];
    const unit = match[2].toLowerCase();
    if (unit.startsWith("d") || unit.startsWith("day")) return `${amount} d`;
    if (unit.startsWith("h")) return `${amount} h`;
    return `${amount} min`;
  });

  return parts.length ? parts.join(" ") : text;
}

export function formatCompactRouteDistance(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) return "";

  const lower = text.toLowerCase();
  const parts = Array.from(
    lower.matchAll(
      new RegExp(
        `(${ROUTE_NUMBER_PATTERN})\\s*(kil[oó]metros?|kilometers?|kilometres?|km|metros?|meters?|metres?|m)`,
        "gi",
      ),
    ),
  ).map((match) => {
    const amount = match[1];
    const unit = match[2].toLowerCase();
    return `${amount} ${unit.startsWith("k") ? "km" : "m"}`;
  });

  return parts.length ? parts.join(" ") : text;
}

