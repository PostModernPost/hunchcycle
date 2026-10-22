"use server";
// Interviews: an interview is a kind of evidence, so saving one also keeps its evidence row in step.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { clamp, toDate, toText, type Result } from "@/lib/parse";
import { INTERVIEW_TEXT_FIELDS, type InterviewInput, type InterviewTextField } from "@/lib/interview-fields";

const TEXT_FIELDS = INTERVIEW_TEXT_FIELDS;

export async function saveInterview(v: InterviewInput): Promise<Result> {
  if (!v.runId) return { ok: false, error: "Pick the session this interview happened in." };
  let personId = v.personId;
  if (!personId) {
    if (!v.newPersonName.trim()) return { ok: false, error: "Pick a person, or type a name to add someone new." };
    const [p] = await db.insert(s.people).values({ name: v.newPersonName.trim() }).returning();
    personId = p.id;
  }

  const text = Object.fromEntries(TEXT_FIELDS.map((f) => [f, toText(v.fields[f])])) as Record<InterviewTextField, string | null>;
  const coldHot = s.coldHot.enumValues.includes(v.coldHot as never) ? (v.coldHot as "cold") : null;
  const score = v.score ? clamp(Number(v.score), 1, 10) : null;
  const scoreSource = score == null ? null : v.scoreSource === "guessed" ? ("guessed" as const) : ("asked" as const);
  const values = {
    personId,
    date: toDate(v.date),
    interviewers: toText(v.interviewers),
    recordingDevice: toText(v.recordingDevice),
    scriptId: toText(v.scriptId),
    ...text,
    coldHot,
    score,
    scoreSource,
  };
  // the evidence row's summary is what shows on the Sessions page
  const summary = text.problem ?? text.observation ?? text.insights ?? text.summaryText?.slice(0, 300) ?? null;

  let id = v.id;
  if (id) {
    const [iv] = await db.update(s.interviews).set(values).where(eq(s.interviews.id, id)).returning();
    if (!iv) return { ok: false, error: "Interview not found." };
    await db.update(s.evidence).set({ runId: v.runId, summary }).where(eq(s.evidence.id, iv.evidenceId));
  } else {
    const [ev] = await db.insert(s.evidence).values({ runId: v.runId, type: "interview", summary }).returning();
    const [iv] = await db.insert(s.interviews).values({ ...values, evidenceId: ev.id }).returning();
    id = iv.id;
  }

  for (const a of v.answers) {
    const asked: (typeof s.asked.enumValues)[number] = s.asked.enumValues.includes(a.asked as never) ? (a.asked as "yes") : "not_recorded";
    const row = { interviewId: id, questionId: a.questionId, text: toText(a.text), asked };
    await db
      .insert(s.answers)
      .values(row)
      .onConflictDoUpdate({ target: [s.answers.interviewId, s.answers.questionId], set: { text: row.text, asked: row.asked } });
  }
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Deleting an interview removes its evidence row and answers too. The person stays. */
export async function deleteInterview(id: string): Promise<Result> {
  const [iv] = await db.select().from(s.interviews).where(eq(s.interviews.id, id));
  if (!iv) return { ok: false, error: "Interview not found." };
  await db.delete(s.evidence).where(eq(s.evidence.id, iv.evidenceId));
  revalidatePath("/", "layout");
  return { ok: true, id: iv.personId };
}
