export function createRealtimeTopic(prefix: string, ...parts: Array<string | number | null | undefined>) {
  const base = [prefix, ...parts]
    .filter((part): part is string | number => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, "-"))
    .join("-");

  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${base}-${suffix}`;
}
