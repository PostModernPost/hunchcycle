import { db } from "@/db";
import { PageTitle } from "@/components/ui";
import { NewSession, SessionCard, type SessionData } from "@/components/sessions/SessionCard";
import { experimentName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const [rows, sprints] = await Promise.all([
    db.query.runs.findMany({
      with: {
        experiments: { with: { experiment: { with: { type: true, metrics: { orderBy: (m, { asc }) => [asc(m.order)] } } } } },
        evidence: { with: { interview: { with: { person: true } }, metrics: true }, orderBy: (e, { asc }) => [asc(e.createdAt)] },
      },
    }),
    db.query.experiments.findMany({ with: { type: true }, orderBy: (e, { asc }) => [asc(e.createdAt)] }),
  ]);
  // newest first; sessions without a date go last
  rows.sort((a, b) => (b.startDate?.getTime() ?? -Infinity) - (a.startDate?.getTime() ?? -Infinity));

  const sessions: SessionData[] = rows.map(({ experiments, evidence, ...r }) => ({
    ...r,
    sprints: experiments.map(({ experiment: e }) => ({ id: e.id, name: experimentName(e), metrics: e.metrics.map((m) => ({ id: m.id, name: m.name })) })),
    evidence: evidence.map((e) => ({
      id: e.id,
      type: e.type,
      summary: e.summary,
      metricIds: e.metrics.map((m) => m.metricId),
      interview: e.interview ? { id: e.interview.id, personName: e.interview.person.name } : null,
    })),
  }));

  return (
    <div className="max-w-4xl">
      <PageTitle title="Sessions" sub="Each time you went out and collected evidence, like an event night or a day of interviews. One session can serve several sprints." />
      <div className="mb-4">
        <NewSession />
      </div>
      <div className="space-y-3">
        {sessions.map((r) => (
          <SessionCard key={r.id} session={r} allSprints={sprints.map((e) => ({ id: e.id, name: experimentName(e) }))} />
        ))}
      </div>
    </div>
  );
}
