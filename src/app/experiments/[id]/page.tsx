import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, Field, PageTitle, Pill, SeedFlag } from "@/components/ui";
import { experimentName, experimentSubtitle, fmtDate, pct, STAGE_LABELS, STATUS_STYLES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExperimentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.query.experiments.findFirst({
    where: eq(s.experiments.id, id),
    with: {
      type: true,
      assumptions: { with: { assumption: true } },
      metrics: { with: { readings: true }, orderBy: (m, { asc }) => [asc(m.order)] },
      runs: { with: { run: true } },
      script: true,
      comments: true,
    },
  });
  if (!e) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/?card=${e.id}`} className="text-sm text-muted hover:text-ink">
        ← Back to the board
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Pill>{STAGE_LABELS[e.stage]}</Pill>
        {e.decision && <Pill className="bg-stone-800 text-white">{e.decision}</Pill>}
        <SeedFlag tags={e.tags} />
      </div>
      <PageTitle title={experimentName(e)} sub={experimentSubtitle(e) ?? undefined} />

      <Section title="Assumptions tested">
        {e.assumptions.map(({ assumption: a }) => (
          <Link key={a.id} href={`/assumptions#${a.id}`} className="mb-2 flex items-start gap-2 text-sm hover:underline">
            <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
            <span>{a.statement}</span>
          </Link>
        ))}
      </Section>

      <Section title="Hypothesis">
        <Field label="Who" value={e.who} />
        <Field label="Action" value={e.action} />
        <Field label="How many" value={e.howMany} />
        <Field label="By when" value={e.byWhen} />
        <Field label="Because" value={e.becauseNote} />
      </Section>

      <Section title="Experiment">
        <Field label="Type" value={e.type?.name} />
        <Field label="Channel" value={e.channel} />
        <Field label="Sample size" value={e.sampleSizeTarget} />
        <Field label="Start" value={fmtDate(e.startDate)} />
        <Field label="Report" value={fmtDate(e.reportDate)} />
        <Field label="Script" value={e.script && `${e.script.name} ${e.script.versionLabel}`} />
        <Field label="Notes" value={e.notes} />
      </Section>

      <Section title="Metrics">
        {e.metrics.map((m) => (
          <Card key={m.id} className="mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{m.name}</span>
              <Pill>{m.type}</Pill>
              {m.result && <Pill className={m.result === "pass" ? "bg-green-100 text-green-800" : m.result === "fail" ? "bg-red-100 text-red-800" : ""}>{m.result}</Pill>}
            </div>
            <div className="mt-1 text-xs text-muted">Source: {m.source}</div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-green-800">Pass: {m.passLine}</div>
                <div>{m.passDecision}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-red-800">Kill: {m.killLine}</div>
                <div>{m.killDecision}</div>
              </div>
            </div>
            {m.readings.length > 0 && (
              <div className="mt-3 border-t border-line pt-2 text-sm">
                {m.readings.map((r) => (
                  <div key={r.id}>
                    {r.numerator != null && r.denominator != null ? `${r.numerator}/${r.denominator} (${pct(r.numerator, r.denominator)})` : r.value}
                    {!r.verified && <Pill className="ml-2 bg-yellow-100 text-yellow-800">unverified</Pill>}
                    {r.note && <span className="ml-2 text-muted">{r.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </Section>

      <Section title="Sessions">
        {e.runs.map(({ run }) => (
          <div key={run.id} className="text-sm">
            <Link href={`/sessions#${run.id}`} className="hover:underline">
              {run.name}
            </Link>{" "}
            <span className="text-muted">{fmtDate(run.startDate)}</span>
          </div>
        ))}
      </Section>

      <Section title="Results">
        <Field label="Raw learnings" value={e.rawLearnings} />
        <Field label="Insights" value={e.insights} />
      </Section>

      <Section title="Decision">
        <Field label="Decision" value={e.decision} />
        <Field label="Note" value={e.decisionNote} />
      </Section>

      {e.comments.length > 0 && (
        <Section title="Comments">
          {e.comments.map((c) => (
            <Card key={c.id} className="mb-2 text-sm">
              <div className="text-xs text-muted">
                {c.authorName ?? c.role} · {fmtDate(c.createdAt)}
              </div>
              <div className="mt-1">{c.body}</div>
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {empty ? <div className="text-sm text-muted">None yet</div> : children}
    </section>
  );
}
