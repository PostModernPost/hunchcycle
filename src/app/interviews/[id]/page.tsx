import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, Field, PageTitle, Pill } from "@/components/ui";
import { fmtDate, HEAT_STYLES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InterviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const iv = await db.query.interviews.findFirst({
    where: eq(s.interviews.id, id),
    with: {
      person: true,
      script: { with: { questions: { with: { question: true } } } },
      answers: true,
      evidence: { with: { run: true } },
    },
  });
  if (!iv) notFound();
  const answerByQ = new Map(iv.answers.map((a) => [a.questionId, a]));
  const scriptQs = (iv.script?.questions ?? []).sort((a, b) => a.order - b.order);
  const p = iv.person;

  return (
    <div className="max-w-3xl">
      <Link href="/people" className="text-sm text-muted hover:text-ink">
        ← People
      </Link>
      <PageTitle
        title={p.name}
        sub={[fmtDate(iv.date), iv.evidence.run.name, iv.interviewers && `by ${iv.interviewers}`].filter(Boolean).join(" · ")}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {iv.coldHot && <Pill className={HEAT_STYLES[iv.coldHot]}>{iv.coldHot}</Pill>}
        {iv.score != null && (
          <Pill className={iv.scoreSource === "guessed" ? "bg-yellow-100 text-yellow-800" : ""}>
            score {iv.score}/10{iv.scoreSource === "guessed" ? " (guessed, unverified)" : ""}
          </Pill>
        )}
        {p.segments.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <div>
          <Field label="Problem" value={iv.problem} />
          <Field label="Persona" value={iv.persona} />
          <Field label="Surprise" value={iv.surprise} />
          <Field label="Best quote" value={iv.bestQuote && `“${iv.bestQuote}”`} />
          <Field label="Question that got the quote" value={iv.questionThatGotQuote} />
          <Field label="Observation" value={iv.observation} />
          <Field label="Insights" value={iv.insights} />
          <Field label="Heat note" value={iv.coldHotNote} />
          <Field label="Score note" value={iv.scoreNote} />
          <Field label="Next action" value={iv.nextAction} />
          <Field label="Method" value={iv.method} />
          <Field label="Solution" value={iv.solution} />
        </div>
        <Card className="h-fit">
          <Field label="Age" value={p.age} />
          <Field label="Gender" value={p.gender} />
          <Field label="Location" value={p.location} />
          <Field label="Found via" value={p.channelFound} />
          <Field label="Contact" value={p.contact} />
          <Field label="Fantasy" value={p.fantasy} />
          <Field label="Bettor" value={p.bettor} />
          <Field label="Where to find others" value={p.whereToFindOthers} />
          <Field label="Recording" value={iv.recordingDevice} />
          <Field label="Notes" value={p.notes} />
        </Card>
      </div>

      {scriptQs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Answers ({iv.script!.name} {iv.script!.versionLabel})
          </h2>
          <div className="space-y-2">
            {scriptQs.map((sq) => {
              const a = answerByQ.get(sq.questionId);
              return (
                <Card key={sq.id} className="p-3">
                  <Link href={`/questions/${sq.questionId}`} className="text-xs font-medium text-muted hover:underline">
                    {sq.wordingOverride ?? sq.question.text}
                  </Link>
                  <div className="mt-1 text-sm">
                    {a?.text ? a.text : <span className="text-muted">{a?.asked === "no" ? "Not asked" : "Not recorded"}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {iv.summaryText && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Summary (from Plaud write-up)</h2>
          <Card className="whitespace-pre-wrap text-sm">{iv.summaryText}</Card>
        </section>
      )}
    </div>
  );
}
