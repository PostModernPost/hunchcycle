"use server";
// Scripts and the question bank. A script version that already has interviews is locked: change it by
// copying it to a new version, so old interviews keep the questions they were asked.
import { revalidatePath } from "next/cache";
import { count, eq, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ownerOnly } from "@/lib/auth";
import { toList, toText, type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

async function lockedMessage(scriptId: string) {
  const [{ n }] = await db.select({ n: count() }).from(s.interviews).where(eq(s.interviews.scriptId, scriptId));
  return n > 0 ? `This version is used by ${n} interview${n === 1 ? "" : "s"}. Copy it to a new version to change its questions.` : null;
}

export async function createScript(name: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!name.trim()) return { ok: false, error: "Give the script a name." };
  const [x] = await db.insert(s.scripts).values({ name: name.trim(), versionLabel: "v1" }).returning();
  return done(x.id);
}

/** Copy a script to the next version of the same name (v1 to v2), keeping question order and wording. */
export async function copyToNewVersion(id: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [src] = await db.select().from(s.scripts).where(eq(s.scripts.id, id));
  if (!src) return { ok: false, error: "Script not found." };
  const siblings = await db.select({ v: s.scripts.versionLabel }).from(s.scripts).where(eq(s.scripts.name, src.name));
  const highest = Math.max(0, ...siblings.map((x) => parseInt(x.v.replace(/\D/g, ""), 10) || 0));
  const [copy] = await db.insert(s.scripts).values({ name: src.name, versionLabel: `v${highest + 1}`, parentId: src.id }).returning();
  const qs = await db.select().from(s.scriptQuestions).where(eq(s.scriptQuestions.scriptId, id));
  if (qs.length)
    await db.insert(s.scriptQuestions).values(qs.map((q) => ({ scriptId: copy.id, questionId: q.questionId, order: q.order, wordingOverride: q.wordingOverride })));
  return done(copy.id);
}

export async function updateScript(id: string, field: string, value: unknown): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (field === "name" || field === "versionLabel") {
    if (!toText(value)) return { ok: false, error: "This can't be empty." };
    await db.update(s.scripts).set({ [field]: String(value).trim() }).where(eq(s.scripts.id, id));
  } else if (field === "notes") {
    await db.update(s.scripts).set({ notes: toText(value) }).where(eq(s.scripts.id, id));
  } else return { ok: false, error: `Unknown field ${field}` };
  return done();
}

async function append(scriptId: string, questionId: string) {
  const [{ n }] = await db.select({ n: max(s.scriptQuestions.order) }).from(s.scriptQuestions).where(eq(s.scriptQuestions.scriptId, scriptId));
  await db.insert(s.scriptQuestions).values({ scriptId, questionId, order: (n ?? -1) + 1 }).onConflictDoNothing();
}

export async function addQuestionToScript(scriptId: string, questionId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const locked = await lockedMessage(scriptId);
  if (locked) return { ok: false, error: locked };
  await append(scriptId, questionId);
  return done();
}

/** Adds a brand new question to the bank and to this script. */
export async function addNewQuestionToScript(scriptId: string, text: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!text.trim()) return { ok: false, error: "Write the question first." };
  const locked = await lockedMessage(scriptId);
  if (locked) return { ok: false, error: locked };
  const [q] = await db.insert(s.questions).values({ text: text.trim() }).returning();
  await append(scriptId, q.id);
  return done(q.id);
}

export async function removeFromScript(scriptQuestionId: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [sq] = await db.select().from(s.scriptQuestions).where(eq(s.scriptQuestions.id, scriptQuestionId));
  if (!sq) return { ok: false, error: "Question not found in this script." };
  const locked = await lockedMessage(sq.scriptId);
  if (locked) return { ok: false, error: locked };
  await db.delete(s.scriptQuestions).where(eq(s.scriptQuestions.id, scriptQuestionId));
  return done();
}

/** Swap a question with its neighbor above or below. */
export async function moveInScript(scriptQuestionId: string, dir: "up" | "down"): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [sq] = await db.select().from(s.scriptQuestions).where(eq(s.scriptQuestions.id, scriptQuestionId));
  if (!sq) return { ok: false, error: "Question not found in this script." };
  const locked = await lockedMessage(sq.scriptId);
  if (locked) return { ok: false, error: locked };
  const all = (await db.select().from(s.scriptQuestions).where(eq(s.scriptQuestions.scriptId, sq.scriptId))).sort((a, b) => a.order - b.order);
  const i = all.findIndex((x) => x.id === sq.id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return { ok: true };
  // renumber 0..n so swaps stay clean even if old orders had gaps
  [all[i], all[j]] = [all[j], all[i]];
  for (const [k, x] of all.entries()) if (x.order !== k) await db.update(s.scriptQuestions).set({ order: k }).where(eq(s.scriptQuestions.id, x.id));
  return done();
}

/** Wording for this script only. The question keeps its identity in the bank, so answers stay comparable. */
export async function setWording(scriptQuestionId: string, text: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const [sq] = await db.select().from(s.scriptQuestions).where(eq(s.scriptQuestions.id, scriptQuestionId));
  if (!sq) return { ok: false, error: "Question not found in this script." };
  const locked = await lockedMessage(sq.scriptId);
  if (locked) return { ok: false, error: locked };
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, sq.questionId));
  const override = toText(text) && text.trim() !== q?.text ? text.trim() : null;
  await db.update(s.scriptQuestions).set({ wordingOverride: override }).where(eq(s.scriptQuestions.id, scriptQuestionId));
  return done();
}

// ---------- question bank ----------

export async function createQuestion(text: string, tags: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!text.trim()) return { ok: false, error: "Write the question first." };
  const [q] = await db.insert(s.questions).values({ text: text.trim(), tags: toList(tags) }).returning();
  return done(q.id);
}

export async function updateQuestion(id: string, field: "text" | "tags", value: string): Promise<Result> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (field === "text") {
    if (!value.trim()) return { ok: false, error: "The question can't be empty." };
    await db.update(s.questions).set({ text: value.trim() }).where(eq(s.questions.id, id));
  } else {
    await db.update(s.questions).set({ tags: toList(value) }).where(eq(s.questions.id, id));
  }
  return done();
}

