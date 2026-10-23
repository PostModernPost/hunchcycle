"use server";
// Board and card drawer writes. Every forward move is re-checked against the gates here.
import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ownerOnly } from "@/lib/auth";
import { loadCard } from "@/lib/board-data";
import { blockedMessage, checkMove, toGateCard, type Stage } from "@/lib/gates";

import { clamp, toDate, toInt, toText, type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

// ---------- Cards ----------

/** Next number for a type: Customer Interviews 1, 2, 3... */
async function nextCycle(typeId: string) {
  const [{ n }] = await db.select({ n: max(s.experiments.cycleNumber) }).from(s.experiments).where(eq(s.experiments.typeId, typeId));
  return (n ?? 0) + 1;
}

export async function createCard(typeId: string, subtitle?: string, assumptionId?: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!typeId) return { ok: false, error: "Choose a type first." };
  const [row] = await db
    .insert(s.experiments)
    .values({ typeId, cycleNumber: await nextCycle(typeId), title: toText(subtitle), stage: "assumption" })
    .returning();
  if (assumptionId) await db.insert(s.experimentAssumptions).values({ experimentId: row.id, assumptionId });
  return done(row.id);
}

export async function createType(name: string, needsScript: boolean): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Give the type a name." };
  const existing = (await db.select().from(s.experimentTypes)).find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return done(existing.id);
  const [row] = await db.insert(s.experimentTypes).values({ name: clean, needsScript }).returning();
  return done(row.id);
}

/** Changing the type gives the experiment the next number in its new type. */
export async function changeType(id: string, typeId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [e] = await db.select().from(s.experiments).where(eq(s.experiments.id, id));
  if (!e) return { ok: false, error: "Sprint not found." };
  if (!typeId || e.typeId === typeId) return { ok: true };
  await db
    .update(s.experiments)
    .set({ typeId, cycleNumber: await nextCycle(typeId), updatedAt: new Date() })
    .where(eq(s.experiments.id, id));
  return done();
}

export async function moveCard(id: string, to: Stage): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (to === "closed") return closeCard(id);
  if (to === "metrics") to = "experiment";
  const card = await loadCard(id);
  if (!card) return { ok: false, error: "Sprint not found." };
  if (card.stage === to) return { ok: true };
  const check = checkMove(toGateCard(card), to);
  if (!check.ok) return { ok: false, error: blockedMessage(check) };
  await db.update(s.experiments).set({ stage: to, closedAt: null, updatedAt: new Date() }).where(eq(s.experiments.id, id));
  await db.insert(s.stageChanges).values({ experimentId: id, fromStage: card.stage, toStage: to });
  return done();
}

export async function closeCard(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const card = await loadCard(id);
  if (!card) return { ok: false, error: "Sprint not found." };
  const check = checkMove(toGateCard(card), "closed");
  if (!check.ok) return { ok: false, error: blockedMessage(check) };
  await db.update(s.experiments).set({ stage: "closed", closedAt: new Date(), updatedAt: new Date() }).where(eq(s.experiments.id, id));
  await db.insert(s.stageChanges).values({ experimentId: id, fromStage: card.stage, toStage: "closed" });
  return done();
}

const TEXT_FIELDS = ["title", "who", "action", "howMany", "byWhen", "becauseNote", "channel", "rawLearnings", "insights", "decisionNote", "notes"] as const;
const METHODS = s.method.enumValues;
const DECISIONS = s.decision.enumValues;

export async function updateCard(id: string, field: string, value: unknown): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  let patch: Partial<typeof s.experiments.$inferInsert>;
  if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    patch = { [field]: toText(value) };
  } else if (field === "method") {
    patch = { method: METHODS.includes(value as never) ? (value as (typeof METHODS)[number]) : null };
  } else if (field === "decision") {
    patch = { decision: DECISIONS.includes(value as never) ? (value as (typeof DECISIONS)[number]) : null };
  } else if (field === "startDate" || field === "reportDate") {
    patch = { [field]: toDate(value) };
  } else if (field === "sampleSizeTarget") {
    patch = { sampleSizeTarget: toInt(value) };
  } else if (field === "scriptId") {
    patch = { scriptId: toText(value) };
  } else {
    return { ok: false, error: `Unknown field ${field}` };
  }
  await db.update(s.experiments).set({ ...patch, updatedAt: new Date() }).where(eq(s.experiments.id, id));
  return done();
}

/** Split from Hypothesis: a sibling card with the same assumptions and hypothesis. */
export async function splitCard(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const card = await loadCard(id);
  if (!card) return { ok: false, error: "Sprint not found." };
  if (card.stage !== "hypothesis") return { ok: false, error: "Sprints can only be split from the Hypothesis column." };
  const group = card.siblingGroup ?? crypto.randomUUID();
  if (!card.siblingGroup) await db.update(s.experiments).set({ siblingGroup: group }).where(eq(s.experiments.id, id));
  const [copy] = await db
    .insert(s.experiments)
    .values({
      typeId: card.typeId,
      cycleNumber: card.typeId ? await nextCycle(card.typeId) : null,
      title: card.title ? `${card.title} (variant)` : "Variant",
      stage: "hypothesis",
      who: card.who,
      action: card.action,
      howMany: card.howMany,
      byWhen: card.byWhen,
      becauseNote: card.becauseNote,
      siblingGroup: group,
    })
    .returning();
  if (card.assumptions.length)
    await db.insert(s.experimentAssumptions).values(card.assumptions.map((a) => ({ experimentId: copy.id, assumptionId: a.id })));
  return done(copy.id);
}

/**
 * Loop back (BRIEF section 4): a closed sprint starts the next one of its type in Assumption,
 * prefilled with the same assumptions plus any new ones that came out of its results.
 */
export async function createNextExperiment(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const card = await loadCard(id);
  if (!card) return { ok: false, error: "Sprint not found." };
  if (card.stage !== "closed") return { ok: false, error: "Close this sprint before starting the next one." };
  const [next] = await db
    .insert(s.experiments)
    .values({
      typeId: card.typeId,
      cycleNumber: card.typeId ? await nextCycle(card.typeId) : null,
      title: card.typeId ? null : `${card.title ?? "Sprint"} (next)`,
      stage: "assumption",
    })
    .returning();
  const ids = [...new Set([...card.assumptions, ...card.spawned].map((a) => a.id))];
  if (ids.length) await db.insert(s.experimentAssumptions).values(ids.map((assumptionId) => ({ experimentId: next.id, assumptionId })));
  return done(next.id);
}

/** Clears the "seeded, review me" tag once Adam has checked an imported experiment. */
export async function markReviewed(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [e] = await db.select().from(s.experiments).where(eq(s.experiments.id, id));
  if (!e) return { ok: false, error: "Sprint not found." };
  await db
    .update(s.experiments)
    .set({ tags: e.tags.filter((t) => t !== "seeded, review me"), updatedAt: new Date() })
    .where(eq(s.experiments.id, id));
  return done();
}

// ---------- Assumptions ----------

export async function linkAssumption(experimentId: string, assumptionId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db.insert(s.experimentAssumptions).values({ experimentId, assumptionId }).onConflictDoNothing();
  return done();
}

export async function unlinkAssumption(experimentId: string, assumptionId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db
    .delete(s.experimentAssumptions)
    .where(and(eq(s.experimentAssumptions.experimentId, experimentId), eq(s.experimentAssumptions.assumptionId, assumptionId)));
  return done();
}

export async function createAssumption(
  experimentId: string,
  v: { statement: string; category: string; importance: number; evidence: number },
): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!v.statement.trim()) return { ok: false, error: "Write the assumption first." };
  const category = s.assumptionCategory.enumValues.includes(v.category as never)
    ? (v.category as (typeof s.assumptionCategory.enumValues)[number])
    : "other";
  const [a] = await db
    .insert(s.assumptions)
    .values({ statement: v.statement.trim(), category, importance: clamp(v.importance, 1, 5), evidence: clamp(v.evidence, 1, 5) })
    .returning();
  await db.insert(s.experimentAssumptions).values({ experimentId, assumptionId: a.id });
  return done(a.id);
}

/** Decision column: record the new evidence and status for one linked assumption. */
export async function updateAssumptionFromDecision(
  experimentId: string,
  assumptionId: string,
  v: { evidence: number; status: string; note: string },
): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [a] = await db.select().from(s.assumptions).where(eq(s.assumptions.id, assumptionId));
  if (!a) return { ok: false, error: "Assumption not found." };
  const status = s.assumptionStatus.enumValues.includes(v.status as never)
    ? (v.status as (typeof s.assumptionStatus.enumValues)[number])
    : a.status;
  const evidence = clamp(v.evidence, 1, 5);
  await db.insert(s.assumptionHistory).values({
    assumptionId,
    experimentId,
    fromEvidence: a.evidence,
    toEvidence: evidence,
    fromStatus: a.status,
    toStatus: status,
    note: toText(v.note),
  });
  await db.update(s.assumptions).set({ evidence, status, updatedAt: new Date() }).where(eq(s.assumptions.id, assumptionId));
  return done();
}

// ---------- Metrics ----------

export async function addMetric(experimentId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [{ n }] = await db.select({ n: max(s.metrics.order) }).from(s.metrics).where(eq(s.metrics.experimentId, experimentId));
  const [m] = await db
    .insert(s.metrics)
    .values({ experimentId, name: "New metric", type: "rate", order: (n ?? -1) + 1 })
    .returning();
  return done(m.id);
}

const METRIC_TEXT = ["name", "source", "passLine", "passDecision", "killLine", "killDecision"] as const;

export async function updateMetric(id: string, field: string, value: unknown): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  let patch: Partial<typeof s.metrics.$inferInsert>;
  if ((METRIC_TEXT as readonly string[]).includes(field)) {
    if (field === "name" && !toText(value)) return { ok: false, error: "The metric needs a name." };
    patch = { [field]: toText(value) };
  } else if (field === "type") {
    patch = { type: s.metricType.enumValues.includes(value as never) ? (value as "rate") : "rate" };
  } else if (field === "result") {
    patch = { result: s.metricResult.enumValues.includes(value as never) ? (value as "pass") : null };
  } else {
    return { ok: false, error: `Unknown field ${field}` };
  }
  await db.update(s.metrics).set(patch).where(eq(s.metrics.id, id));
  return done();
}

export async function deleteMetric(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db.delete(s.metrics).where(eq(s.metrics.id, id));
  return done();
}

/** A reading with linked evidence is verified; one without is shown as unverified. */
export async function addReading(
  metricId: string,
  v: { numerator: string; denominator: string; value: string; date: string; note: string; evidenceId: string },
): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const numerator = toInt(v.numerator);
  const denominator = toInt(v.denominator);
  const value = numerator != null && denominator ? numerator / denominator : v.value.trim() ? Number(v.value) : null;
  if (value == null || !Number.isFinite(value)) return { ok: false, error: "Enter a number, or a count out of a total." };
  const [r] = await db
    .insert(s.metricReadings)
    .values({
      metricId,
      numerator,
      denominator,
      value,
      date: toDate(v.date) ?? new Date(),
      note: toText(v.note),
      verified: !!v.evidenceId,
    })
    .returning();
  if (v.evidenceId) await db.insert(s.readingEvidence).values({ readingId: r.id, evidenceId: v.evidenceId });
  return done();
}

// ---------- Runs and evidence ----------

export async function linkRun(experimentId: string, runId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db.insert(s.experimentRuns).values({ experimentId, runId }).onConflictDoNothing();
  return done();
}

export async function unlinkRun(experimentId: string, runId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db.delete(s.experimentRuns).where(and(eq(s.experimentRuns.experimentId, experimentId), eq(s.experimentRuns.runId, runId)));
  return done();
}

export async function createRun(experimentId: string, v: { name: string; date: string }): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!v.name.trim()) return { ok: false, error: "Give the session a name." };
  const [run] = await db.insert(s.runs).values({ name: v.name.trim(), startDate: toDate(v.date) }).returning();
  await db.insert(s.experimentRuns).values({ experimentId, runId: run.id });
  return done(run.id);
}

export async function addEvidence(runId: string, v: { type: string; summary: string }): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!v.summary.trim()) return { ok: false, error: "Write what you saw or heard." };
  const type = s.evidenceType.enumValues.includes(v.type as never) ? (v.type as "observation") : "observation";
  await db.insert(s.evidence).values({ runId, type, summary: v.summary.trim() });
  return done();
}
