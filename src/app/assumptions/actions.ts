"use server";
// Assumptions outside the decision step: create them, edit them, and spawn new ones from a sprint's results.
// Any change to evidence or status goes into the assumption's history.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { clamp, toInt, toText, type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

type Draft = { statement: string; category: string; importance: number; evidence: number };
const category = (c: string) =>
  s.assumptionCategory.enumValues.includes(c as never) ? (c as (typeof s.assumptionCategory.enumValues)[number]) : "other";

export async function createAssumption(v: Draft): Promise<Result> {
  if (!v.statement.trim()) return { ok: false, error: "Write the assumption first." };
  const [a] = await db
    .insert(s.assumptions)
    .values({ statement: v.statement.trim(), category: category(v.category), importance: clamp(v.importance, 1, 5), evidence: clamp(v.evidence, 1, 5) })
    .returning();
  return done(a.id);
}

/** A new assumption that came out of a sprint's results. The next sprint starts with it. */
export async function createFromResults(experimentId: string, v: Draft & { parentId: string }): Promise<Result> {
  if (!v.statement.trim()) return { ok: false, error: "Write the assumption first." };
  const [a] = await db
    .insert(s.assumptions)
    .values({
      statement: v.statement.trim(),
      category: category(v.category),
      importance: clamp(v.importance, 1, 5),
      evidence: clamp(v.evidence, 1, 5),
      parentId: toText(v.parentId),
      spawnedByExperimentId: experimentId,
    })
    .returning();
  await db.insert(s.assumptionHistory).values({ assumptionId: a.id, experimentId, toEvidence: a.evidence, toStatus: a.status, note: "Came out of this sprint's results" });
  return done(a.id);
}

export async function updateAssumption(id: string, field: string, value: unknown): Promise<Result> {
  const [a] = await db.select().from(s.assumptions).where(eq(s.assumptions.id, id));
  if (!a) return { ok: false, error: "Assumption not found." };
  let patch: Partial<typeof s.assumptions.$inferInsert>;
  if (field === "statement") {
    if (!toText(value)) return { ok: false, error: "The assumption can't be empty." };
    patch = { statement: String(value).trim() };
  } else if (field === "notes") {
    patch = { notes: toText(value) };
  } else if (field === "category") {
    patch = { category: category(String(value)) };
  } else if (field === "importance") {
    patch = { importance: clamp(Number(value), 1, 5) };
  } else if (field === "willingnessToChange") {
    const n = toInt(value);
    patch = { willingnessToChange: n == null ? null : clamp(n, 1, 10) };
  } else if (field === "evidence" || field === "status") {
    const evidence = field === "evidence" ? clamp(Number(value), 1, 5) : a.evidence;
    const status = field === "status" && s.assumptionStatus.enumValues.includes(value as never) ? (value as typeof a.status) : a.status;
    if (evidence === a.evidence && status === a.status) return { ok: true };
    patch = { evidence, status };
    await db.insert(s.assumptionHistory).values({
      assumptionId: id,
      fromEvidence: a.evidence,
      toEvidence: evidence,
      fromStatus: a.status,
      toStatus: status,
      note: "Changed by hand on the assumption page",
    });
  } else {
    return { ok: false, error: `Unknown field ${field}` };
  }
  await db.update(s.assumptions).set({ ...patch, updatedAt: new Date() }).where(eq(s.assumptions.id, id));
  return done();
}
