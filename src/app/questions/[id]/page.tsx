import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, PageTitle, Pill } from "@/components/ui";
import { QuestionEditor } from "@/components/scripts/ScriptEditor";
import { inputCls } from "@/components/styles";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Every answer to one bank question, across interviews and script versions (BRIEF section 6.5).
export default async function QuestionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ script?: string; segment?: string }> }) {
  const { id } = await params;
  const { script = "", segment = "" } = await searchParams;
  const q = await db.query.questions.findFirst({
    where: eq(s.questions.id, id),
    with: {
      scriptQuestions: { with: { script: true } },
      answers: { with: { interview: { with: { person: true, script: true } } } },
    },
  });
  if (!q) notFound();

  const scripts = [...new Map(q.answers.map((a) => a.interview.script).filter(Boolean).map((x) => [x!.id, x!])).values()].sort((a, b) =>
    `${a.name} ${a.versionLabel}`.localeCompare(`${b.name} ${b.versionLabel}`),
  );
  const segments = [...new Set(q.answers.flatMap((a) => a.interview.person.segments))].sort();
  const matches = q.answers
    .filter((a) => !script || a.interview.scriptId === script)
    .filter((a) => !segment || a.interview.person.segments.includes(segment))
    .sort((a, b) => (b.interview.date?.getTime() ?? 0) - (a.interview.date?.getTime() ?? 0));
  const answered = matches.filter((a) => a.text);
  const notAsked = matches.filter((a) => !a.text && a.asked === "no").length;
  const notRecorded = matches.length - answered.length - notAsked;

  return (
    <div className="max-w-3xl">
      <Link href="/scripts" className="text-sm text-muted hover:text-ink">
        ← Scripts
      </Link>
      <PageTitle title={q.text} sub={`${answered.length} answers, ${notAsked} not asked, ${notRecorded} not recorded`} />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted">In scripts:</span>
        {q.scriptQuestions.map((sq) => (
          <Link key={sq.id} href={`/scripts/${sq.scriptId}`}>
            <Pill>
              {sq.script.name} {sq.script.versionLabel}
              {sq.wordingOverride && sq.wordingOverride !== q.text ? `: "${sq.wordingOverride}"` : ""}
            </Pill>
          </Link>
        ))}
        {q.tags.map((t) => (
          <Pill key={t} className="bg-violet-100 text-violet-800">
            {t}
          </Pill>
        ))}
      </div>
      <div className="mb-4">
        <QuestionEditor question={{ id: q.id, text: q.text, tags: q.tags }} />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block text-xs text-muted">Script version</span>
          <select name="script" defaultValue={script} className={`${inputCls.replace("w-full ", "")} w-56`}>
            <option value="">All versions</option>
            {scripts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} {x.versionLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">Segment</span>
          <select name="segment" defaultValue={segment} className={`${inputCls.replace("w-full ", "")} w-56`}>
            <option value="">All segments</option>
            {segments.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-line bg-raised px-3 py-1.5 font-medium hover:border-stone-400">
          Apply
        </button>
        {(script || segment) && (
          <Link href={`/questions/${q.id}`} className="pb-1.5 text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      <div className="space-y-2">
        {answered.length === 0 && <p className="text-sm text-muted">No answers match.</p>}
        {answered.map((a) => (
          <Card key={a.id} className="p-3">
            <div className="text-xs text-muted">
              <Link href={`/interviews/${a.interviewId}`} className="hover:underline">
                {a.interview.person.name}
              </Link>
              {", "}
              {[fmtDate(a.interview.date), a.interview.script && `${a.interview.script.name} ${a.interview.script.versionLabel}`].filter(Boolean).join(", ")}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{a.text}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
