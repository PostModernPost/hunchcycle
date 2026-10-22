"use server";
// Sessions (runs in the BRIEF) and their evidence.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { toDate, toList, toText, type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

export async function createSession(v: { name: string; startDate: string; endDate: string; location: string; runBy: string }): Promise<Result> {
  if (!v.name.trim()) return { ok: false, error: "Give the session a name." };
  const [row] = await db
    .insert(s.runs)
    .values({ name: v.name.trim(), startDate: toDate(v.startDate), endDate: toDate(v.endDate), location: toText(v.location), runBy: toText(v.runBy) })
    .returning();
  return done(row.id);
}

const TEXT = ["name", "location", "runBy", "notes", "interferenceNote"] as const;

export async function updateSession(id: string, field: string, value: unknown): Promise<Result> {
  let patch: Partial<typeof s.runs.$inferInsert>;
  if ((TEXT as readonly string[]).includes(field)) {
    if (field === "name" && !toText(value)) return { ok: false, error: "The session needs a name." };
    patch = { [field]: toText(value) };
  } else if (field === "startDate" || field === "endDate") {
    patch = { [field]: toDate(value) };
  } else if (field === "recordingLinks") {
    patch = { recordingLinks: toList(value) };
  } else if (field === "interferenceChecked") {
    patch = { interferenceChecked: value === true || value === "true" };
  } else {
    return { ok: false, error: `Unknown field ${field}` };
  }
  await db.update(s.runs).set(patch).where(eq(s.runs.id, id));
  return done();
}

export async function updateEvidence(id: string, v: { summary: string; type: string }): Promise<Result> {
  if (!v.summary.trim()) return { ok: false, error: "Evidence needs a summary." };
  const type = s.evidenceType.enumValues.includes(v.type as never) ? (v.type as "observation") : "observation";
  await db.update(s.evidence).set({ summary: v.summary.trim(), type }).where(eq(s.evidence.id, id));
  return done();
}

/** Interviews are deleted from their own page, not here, so this only removes plain evidence. */
export async function deleteEvidence(id: string): Promise<Result> {
  const [iv] = await db.select({ id: s.interviews.id }).from(s.interviews).where(eq(s.interviews.evidenceId, id));
  if (iv) return { ok: false, error: "This evidence is an interview. Open the interview to change it." };
  await db.delete(s.evidence).where(eq(s.evidence.id, id));
  return done();
}

/** Tag evidence to a metric (or untag it). */
export async function toggleEvidenceMetric(evidenceId: string, metricId: string, on: boolean): Promise<Result> {
  if (on) await db.insert(s.evidenceMetrics).values({ evidenceId, metricId }).onConflictDoNothing();
  else await db.delete(s.evidenceMetrics).where(and(eq(s.evidenceMetrics.evidenceId, evidenceId), eq(s.evidenceMetrics.metricId, metricId)));
  return done();
}
