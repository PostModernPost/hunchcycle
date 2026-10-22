export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
}

export const STAGE_LABELS: Record<string, string> = {
  assumption: "Assumption",
  hypothesis: "Hypothesis",
  experiment: "Test (MVP)",
  metrics: "Metrics",
  running: "Running",
  results: "Results",
  decision: "Decision",
  closed: "Closed",
};

type Named = { title: string | null; cycleNumber: number | null; type?: { name: string } | null };

/** "Customer Interviews 2". Falls back to the subtitle for an experiment with no type. */
export function experimentName(e: Named): string {
  if (e.type) return `${e.type.name} ${e.cycleNumber ?? ""}`.trim();
  return e.title || "Untitled sprint";
}

/** The optional subtitle (also the MVP name), shown under the name. */
export function experimentSubtitle(e: Named): string | null {
  return e.type ? e.title : null;
}

export function pct(n: number | null | undefined, d: number | null | undefined): string {
  if (n == null || !d) return "";
  return `${Math.round((n / d) * 100)}%`;
}

export const STATUS_STYLES: Record<string, string> = {
  untested: "bg-stone-100 text-stone-700",
  testing: "bg-amber-100 text-amber-800",
  supported: "bg-green-100 text-green-800",
  refuted: "bg-red-100 text-red-800",
  retired: "bg-stone-200 text-stone-500",
};

export const HEAT_STYLES: Record<string, string> = {
  cold: "bg-sky-100 text-sky-800",
  warm: "bg-amber-100 text-amber-800",
  hot: "bg-orange-100 text-orange-800",
};
