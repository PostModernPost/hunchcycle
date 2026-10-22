// Stage gates from BRIEF section 4. Shared by the board (to explain a blocked move)
// and the server actions (to enforce it).
import { STAGES } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/format";

export type Stage = (typeof STAGES)[number];
// Metrics are designed in the Test (MVP) step, so the "metrics" stage is no longer used
// (it stays in the database enum; a card found there is treated as being in "experiment").
export const FLOW: readonly Stage[] = STAGES.filter((s) => s !== "metrics");
export const BOARD_STAGES: readonly Stage[] = FLOW.filter((s) => s !== "closed");
export const flowStage = (s: Stage): Stage => (s === "metrics" ? "experiment" : s);

export type GateCard = {
  stage: Stage;
  who: string | null;
  action: string | null;
  howMany: string | null;
  byWhen: string | null;
  becauseNote: string | null;
  method: string | null;
  startDate: Date | null;
  reportDate: Date | null;
  scriptId: string | null;
  rawLearnings: string | null;
  decision: string | null;
  assumptionIds: string[];
  metrics: {
    name: string;
    source: string | null;
    passLine: string | null;
    passDecision: string | null;
    killLine: string | null;
    killDecision: string | null;
    result: string | null;
  }[];
  runIds: string[];
  // assumptions that have a history entry written by this experiment's decision
  updatedAssumptionIds: string[];
};

export function toGateCard(
  c: Omit<GateCard, "assumptionIds" | "runIds"> & { assumptions: { id: string }[]; runs: { id: string }[] },
): GateCard {
  return { ...c, assumptionIds: c.assumptions.map((a) => a.id), runIds: c.runs.map((r) => r.id) };
}

// Seeded placeholders like "(not set)" or "(not set in doc) ..." count as empty.
export function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") {
    const t = v.trim();
    return t !== "" && !t.toLowerCase().startsWith("(not set");
  }
  return true;
}

/** What is still needed before a card can leave `stage`. Empty list means the gate is open. */
export function missingFor(stage: Stage, c: GateCard): string[] {
  const out: string[] = [];
  switch (stage) {
    case "assumption":
      if (c.assumptionIds.length === 0) out.push("Link at least one assumption");
      break;
    case "hypothesis":
      if (!filled(c.who)) out.push("Who");
      if (!filled(c.action)) out.push("Action");
      if (!filled(c.howMany)) out.push("How many");
      if (!filled(c.byWhen)) out.push("By when");
      // "Because" shows the linked assumption statements, so it is filled once one is linked.
      if (c.assumptionIds.length === 0 && !filled(c.becauseNote)) out.push("Because");
      break;
    case "experiment":
      if (!filled(c.method)) out.push("Method");
      if (!c.startDate) out.push("Start date");
      if (!c.reportDate) out.push("Report date");
      if ((c.method === "interviews" || c.method === "survey") && !c.scriptId) out.push("Script (needed for interviews and surveys)");
      if (c.metrics.length === 0) out.push("At least one metric");
      for (const m of c.metrics) {
        const gaps = [
          !filled(m.source) && "source",
          !filled(m.passLine) && "pass line",
          !filled(m.passDecision) && "pass decision",
          !filled(m.killLine) && "kill line",
          !filled(m.killDecision) && "kill decision",
        ].filter(Boolean);
        if (gaps.length) out.push(`"${m.name}" needs ${gaps.join(", ")}`);
      }
      break;
    case "running":
      if (c.runIds.length === 0) out.push("Link at least one session");
      break;
    case "results":
      for (const m of c.metrics) if (!m.result) out.push(`Result for "${m.name}"`);
      if (!filled(c.rawLearnings)) out.push("Raw learnings");
      break;
    case "decision":
      if (!filled(c.decision)) out.push("Choose persevere, pivot, or kill");
      for (const id of c.assumptionIds) {
        if (!c.updatedAssumptionIds.includes(id)) {
          out.push("Update every linked assumption");
          break;
        }
      }
      break;
  }
  return out;
}

/**
 * Check whether a card can move to `target`. Moving backward is always allowed.
 * Moving forward must pass every gate on the way.
 */
export function checkMove(c: GateCard, target: Stage): { ok: true } | { ok: false; stage: Stage; missing: string[] } {
  const from = FLOW.indexOf(flowStage(c.stage));
  const to = FLOW.indexOf(flowStage(target));
  for (let i = from; i < to; i++) {
    const missing = missingFor(FLOW[i], c);
    if (missing.length) return { ok: false, stage: FLOW[i], missing };
  }
  return { ok: true };
}

export function blockedMessage(r: { stage: Stage; missing: string[] }): string {
  return `To leave ${STAGE_LABELS[r.stage]}, fill in: ${r.missing.join("; ")}.`;
}

export function isStale(c: { stage: string; reportDate: Date | null }, now = new Date()): boolean {
  return c.stage === "running" && !!c.reportDate && c.reportDate < now;
}
