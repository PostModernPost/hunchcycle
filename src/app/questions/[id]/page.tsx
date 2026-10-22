import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, PageTitle, Pill } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await db.query.questions.findFirst({
    where: eq(s.questions.id, id),
    with: {
      scriptQuestions: { with: { script: true } },
      answers: { with: { interview: { with: { person: true, script: true } } } },
    },
  });
  if (!q) notFound();
  const answered = q.answers.filter((a) => a.text);
  const notRecorded = q.answers.length - answered.length;

  return (
    <div className="max-w-3xl">
      <Link href="/scripts" className="text-sm text-muted hover:text-ink">
        ← Scripts
      </Link>
      <PageTitle title={q.text} sub={`${answered.length} answers recorded · ${notRecorded} interviews where it wasn't recorded`} />
      <div className="mb-4 flex flex-wrap gap-1">
        {q.scriptQuestions.map((sq) => (
          <Pill key={sq.id}>
            {sq.script.name} {sq.script.versionLabel}
            {sq.wordingOverride && sq.wordingOverride !== q.text ? `: "${sq.wordingOverride}"` : ""}
          </Pill>
        ))}
      </div>
      <div className="space-y-2">
        {answered.map((a) => (
          <Card key={a.id} className="p-3">
            <div className="text-xs text-muted">
              <Link href={`/interviews/${a.interviewId}`} className="hover:underline">
                {a.interview.person.name}
              </Link>{" "}
              · {fmtDate(a.interview.date)} · {a.interview.script?.name} {a.interview.script?.versionLabel}
            </div>
            <div className="mt-1 text-sm">{a.text}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
