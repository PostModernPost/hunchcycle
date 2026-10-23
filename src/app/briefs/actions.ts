"use server";
// Weekly briefs and the open-questions list the owner keeps.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ownerOnly } from "@/lib/auth";
import { buildBrief } from "@/lib/brief";
import { type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

/** Saves the brief for a range as a snapshot. */
export async function saveBrief(fromIso: string, toIso: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (!(from < to)) return { ok: false, error: "The start of the range has to be before the end." };
  const content = await buildBrief(from, to);
  const [b] = await db.insert(s.weeklyBriefs).values({ rangeStart: from, rangeEnd: to, content }).returning();
  return done(b.id);
}

export async function addOpenQuestion(text: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!text.trim()) return { ok: false, error: "Write the question first." };
  const [q] = await db.insert(s.openQuestions).values({ text: text.trim() }).returning();
  return done(q.id);
}

export async function setQuestionResolved(id: string, resolved: boolean): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  await db.update(s.openQuestions).set({ resolved }).where(eq(s.openQuestions.id, id));
  return done();
}
