import Link from "next/link";
import { db } from "@/db";
import { Card, PageTitle, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const scripts = await db.query.scripts.findMany({
    with: { questions: { with: { question: true } }, interviews: true },
  });
  const bank = await db.query.questions.findMany({
    with: { scriptQuestions: { with: { script: true } }, answers: true },
  });

  return (
    <div className="max-w-4xl">
      <PageTitle title="Scripts and question bank" sub="Scripts are versioned lists of questions from one shared bank, so answers stay comparable across versions." />
      <div className="grid gap-4 sm:grid-cols-2">
        {scripts.map((sc) => (
          <Card key={sc.id}>
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {sc.name} <span className="text-muted">{sc.versionLabel}</span>
              </div>
              <span className="text-xs text-muted">{sc.interviews.length} uses</span>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {sc.questions
                .sort((a, b) => a.order - b.order)
                .map((q) => (
                  <li key={q.id}>
                    <Link href={`/questions/${q.questionId}`} className="hover:underline">
                      {q.wordingOverride ?? q.question.text}
                    </Link>
                  </li>
                ))}
            </ol>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Question bank</h2>
      <Card>
        <ul className="divide-y divide-line text-sm">
          {bank.map((q) => {
            const recorded = q.answers.filter((a) => a.text).length;
            return (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/questions/${q.id}`} className="hover:underline">
                  {q.text}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {q.tags.map((t) => (
                    <Pill key={t} className="bg-violet-100 text-violet-800">
                      {t}
                    </Pill>
                  ))}
                  <Pill>{recorded} answers</Pill>
                  <Pill>{q.scriptQuestions.length} scripts</Pill>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
