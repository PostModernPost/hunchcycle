"use server";
// Comments: the owner and the coach can both comment on any sprint or brief (BRIEF section 8).
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { getRole } from "@/lib/auth";
import { toText, type Result } from "@/lib/parse";

export async function addComment(v: { experimentId?: string; briefId?: string; authorName: string; body: string }): Promise<Result> {
  const role = await getRole();
  if (!role) return { ok: false, error: "Please log in again." };
  if (!v.body.trim()) return { ok: false, error: "Write a comment first." };
  if (!v.experimentId && !v.briefId) return { ok: false, error: "Nothing to comment on." };
  const [c] = await db
    .insert(s.comments)
    .values({ experimentId: v.experimentId ?? null, briefId: v.briefId ?? null, role, authorName: toText(v.authorName), body: v.body.trim() })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true, id: c.id };
}
