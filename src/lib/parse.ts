// Small helpers shared by the server action files.

export type Result = { ok: true; id?: string } | { ok: false; error: string };

// "2026-10-29" from a date input, stored at noon Pacific like the seed.
export const toDate = (v: unknown) => (typeof v === "string" && v ? new Date(`${v}T12:00:00-07:00`) : null);
export const toText = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
export const toInt = (v: unknown) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));
/** "a, b,  c" to ["a", "b", "c"]. */
export const toList = (v: unknown) =>
  typeof v === "string"
    ? v
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
