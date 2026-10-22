import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, PageTitle, Pill, SeedFlag } from "@/components/ui";
import { AssumptionForm, TestThis } from "@/components/assumptions/AssumptionForm";
import { experimentName, fmtDate, STAGE_LABELS, STATUS_STYLES } from "@/lib/format";
import { flowStage } from "@/lib/gates";

export const dynamic = "force-dynamic";

// One assumption: edit it, read its history (each change linked to the sprint decision behind it),
// and see every sprint that tested it, including closed ones (BRIEF sections 3, 4, 6.2).
export default async function AssumptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, types] = await Promise.all([
    db.query.assumptions.findFirst({
      where: eq(s.assumptions.id, id),
      with: {
        experiments: { with: { experiment: { with: { type: true } } } },
        history: { with: { experiment: { with: { type: true } } }, orderBy: (h, { desc }) => [desc(h.createdAt)] },
        parent: true,
        children: true,
        spawnedBy: { with: { type: true } },
      },
    }),
    db.select({ id: s.experimentTypes.id, name: s.experimentTypes.name, needsScript: s.experimentTypes.needsScript }).from(s.experimentTypes).orderBy(s.experimentTypes.name),
  ]);
  if (!a) notFound();
  const sprints = a.experiments.map((x) => x.experiment).sort((x, y) => +x.createdAt - +y.createdAt);

  return (
    <div className="max-w-3xl">
      <Link href="/assumptions" className="text-sm text-muted hover:text-ink">
        ← Assumptions
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
        <Pill>{a.category}</Pill>
        <span className="text-xs text-muted">
          importance {a.importance}/5, evidence {a.evidence}/5
        </span>
        <SeedFlag tags={a.tags} />
      </div>
      <PageTitle title={a.statement} />
      {(a.parent || a.spawnedBy || a.children.length > 0) && (
        <div className="-mt-3 mb-5 space-y-1 text-sm text-muted">
          {a.spawnedBy && (
            <div>
              Came out of the results of{" "}
              <Link href={`/sprints/${a.spawnedBy.id}`} className="underline hover:text-ink">
                {experimentName(a.spawnedBy)}
              </Link>
            </div>
          )}
          {a.parent && (
            <div>
              Grew out of{" "}
              <Link href={`/assumptions/${a.parent.id}`} className="underline hover:text-ink">
                {a.parent.statement}
              </Link>
            </div>
          )}
          {a.children.map((c) => (
            <div key={c.id}>
              Led to{" "}
              <Link href={`/assumptions/${c.id}`} className="underline hover:text-ink">
                {c.statement}
              </Link>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Sprints that tested it ({sprints.length})</h2>
      <div className="mb-2 space-y-2">
        {sprints.map((e) => (
          <Card key={e.id} href={`/sprints/${e.id}`} className="p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{experimentName(e)}</span>
              {e.title && <span className="text-muted">{e.title}</span>}
              <Pill>{STAGE_LABELS[flowStage(e.stage)]}</Pill>
              {e.decision && <Pill className="bg-orange-100 text-orange-800">{e.decision}</Pill>}
            </div>
          </Card>
        ))}
      </div>
      <TestThis assumptionId={a.id} types={types} />

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
      {a.history.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
      <ol className="space-y-2">
        {a.history.map((h) => {
          const evidence = h.fromEvidence != null && h.toEvidence != null && h.fromEvidence !== h.toEvidence ? `evidence ${h.fromEvidence} to ${h.toEvidence}` : null;
          const status = h.toStatus && h.fromStatus !== h.toStatus ? (h.fromStatus ? `${h.fromStatus} to ${h.toStatus}` : `now ${h.toStatus}`) : null;
          return (
            <li key={h.id} className="rounded-md border border-line bg-surface p-3 text-sm">
              <div className="text-xs text-muted">
                {fmtDate(h.createdAt)}
                {h.experiment ? (
                  <>
                    {", decision in "}
                    <Link href={`/sprints/${h.experiment.id}`} className="underline hover:text-ink">
                      {experimentName(h.experiment)}
                    </Link>
                  </>
                ) : (
                  ", changed by hand"
                )}
              </div>
              {(evidence || status) && <div className="mt-0.5 font-medium">{[evidence, status].filter(Boolean).join(", ")}</div>}
              {h.note && <div className="mt-0.5 text-muted">{h.note}</div>}
            </li>
          );
        })}
      </ol>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Details</h2>
      <Card>
        <AssumptionForm
          assumption={{
            id: a.id,
            statement: a.statement,
            category: a.category,
            importance: a.importance,
            evidence: a.evidence,
            willingnessToChange: a.willingnessToChange,
            status: a.status,
            notes: a.notes,
          }}
        />
      </Card>
    </div>
  );
}
