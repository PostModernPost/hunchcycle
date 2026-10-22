import { db, schema as s } from "@/db";
import { Card, PageTitle, Pill, SeedFlag } from "@/components/ui";
import { fmtDate, STAGE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const rows = await db.query.experiments.findMany({
    with: { assumptions: { with: { assumption: true } }, metrics: true, runs: true },
    orderBy: (e, { asc }) => [asc(e.createdAt)],
  });
  const now = new Date();

  return (
    <div>
      <PageTitle title="Experiments" sub="Read-only preview of the board. Drag and drop and the stage gates come in milestone 2." />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {s.STAGES.map((stage) => {
          const cards = rows.filter((r) => r.stage === stage);
          return (
            <div key={stage} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                <span>{STAGE_LABELS[stage]}</span>
                <span>{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map((e) => {
                  const stale = e.stage === "running" && e.reportDate && e.reportDate < now;
                  return (
                    <Card key={e.id} href={`/experiments/${e.id}`} className="p-3">
                      <div className="text-sm font-medium leading-snug">{e.title}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stale && <Pill className="bg-red-100 text-red-800">past report date</Pill>}
                        {e.decision && <Pill>{e.decision}</Pill>}
                        <SeedFlag tags={e.tags} />
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        {e.assumptions.length} assumption{e.assumptions.length === 1 ? "" : "s"} · {e.metrics.length} metric
                        {e.metrics.length === 1 ? "" : "s"} · {e.runs.length} run{e.runs.length === 1 ? "" : "s"}
                        {e.reportDate && <> · report {fmtDate(e.reportDate)}</>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
