import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageTitle } from "@/components/ui";
import { ScriptEditor } from "@/components/scripts/ScriptEditor";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [x, bank] = await Promise.all([
    db.query.scripts.findFirst({
      where: eq(s.scripts.id, id),
      with: { questions: { with: { question: true }, orderBy: (q, { asc }) => [asc(q.order)] }, interviews: { columns: { id: true } } },
    }),
    db.query.questions.findMany({ columns: { id: true, text: true }, orderBy: (q, { asc }) => [asc(q.text)] }),
  ]);
  if (!x) notFound();
  const parent = x.parentId ? await db.query.scripts.findFirst({ where: eq(s.scripts.id, x.parentId) }) : null;

  return (
    <div className="max-w-3xl">
      <Link href="/scripts" className="text-sm text-muted hover:text-ink">
        ← Scripts
      </Link>
      <PageTitle title={`${x.name} ${x.versionLabel}`} sub={`${x.interviews.length} interview${x.interviews.length === 1 ? "" : "s"} use this version`} />
      <ScriptEditor
        script={{ id: x.id, name: x.name, versionLabel: x.versionLabel, notes: x.notes, parent: parent ? { id: parent.id, label: `${parent.name} ${parent.versionLabel}` } : null }}
        questions={x.questions.map((q) => ({ id: q.id, questionId: q.questionId, text: q.wordingOverride ?? q.question.text, bankText: q.question.text }))}
        bank={bank}
        interviewCount={x.interviews.length}
      />
    </div>
  );
}
