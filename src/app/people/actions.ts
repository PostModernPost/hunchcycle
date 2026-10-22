"use server";
// People: stored once, with their interviews stacked under them.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { toInt, toList, toText, type Result } from "@/lib/parse";

const done = (id?: string): Result => {
  revalidatePath("/", "layout");
  return { ok: true, id };
};

export async function createPerson(v: { name: string; channelFound?: string }): Promise<Result> {
  if (!v.name.trim()) return { ok: false, error: "Give the person a name." };
  const [p] = await db.insert(s.people).values({ name: v.name.trim(), channelFound: toText(v.channelFound) }).returning();
  return done(p.id);
}

const TEXT = ["name", "gender", "location", "contact", "channelFound", "platform", "fantasy", "bettor", "whereToFindOthers", "notes"] as const;

export async function updatePerson(id: string, field: string, value: unknown): Promise<Result> {
  let patch: Partial<typeof s.people.$inferInsert>;
  if ((TEXT as readonly string[]).includes(field)) {
    if (field === "name" && !toText(value)) return { ok: false, error: "The person needs a name." };
    patch = { [field]: toText(value) };
  } else if (field === "age") {
    patch = { age: toInt(value) };
  } else if (field === "segments") {
    patch = { segments: toList(value) };
  } else {
    return { ok: false, error: `Unknown field ${field}` };
  }
  await db.update(s.people).set(patch).where(eq(s.people.id, id));
  return done();
}
