import Link from "next/link";
import { db } from "@/db";
import { Card, PageTitle, Pill, SeedFlag } from "@/components/ui";
import { AssumptionMap, STATUS_FILL } from "@/components/assumptions/AssumptionMap";
import { NewAssumption } from "@/components/assumptions/AssumptionForm";
import { experimentName, fmtDate, STATUS_STYLES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssumptionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "list" ? "list" : "map";
  const rows = await db.query.assumptions.findMany({
    with: {
      experiments: { with: { experiment: { with: { type: true } } } },
      history: { with: { experiment: { with: { type: true } } }, orderBy: (h, { asc }) => [asc(h.createdAt)] },
    },
  });
  // riskiest first: high importance, low evidence
  rows.sort((a, b) => b.importance - b.evidence - (a.importance - a.evidence) || b.importance - a.importance);
  const numbered = rows.map((a, i) => ({ ...a, n: i + 1 }));

  const tab = (v: "map" | "list", label: string) => (
    <Link href={v === "map" ? "/assumptions" : "/assumptions?view=list"} className={`px-3 py-1.5 ${view === v ? "bg-raised font-medium text-ink" : "text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <div className="max-w-4xl">
      <PageTitle title="Assumptions" sub="Riskiest first: the ones the business depends on most, with the least proof. Click one to see its history and every sprint that tested it." />
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex overflow-hidden rounded-md border border-line text-sm">
          {tab("map", "Map")}
          {tab("list", "List")}
        </div>
        <div className="flex-1">
          <NewAssumption />
        </div>
      </div>

      {view === "map" ? (
        <>
          <Card className="mb-4">
            <AssumptionMap points={numbered.map((a) => ({ id: a.id, n: a.n, statement: a.statement, importance: a.importance, evidence: a.evidence, status: a.status }))} />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              {Object.entries(STATUS_FILL).map(([s, fill]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: fill }} />
                  {s}
                </span>
              ))}
            </div>
          </Card>
          <ol className="space-y-1 text-sm">
            {numbered.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-muted">{a.n}.</span>
                <Link href={`/assumptions/${a.id}`} className="hover:underline">
                  {a.statement}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {a.importance}/{a.evidence}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="space-y-3">
          {numbered.map((a) => (
            <Card key={a.id} href={`/assumptions/${a.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
                <Pill>{a.category}</Pill>
                <span className="text-xs text-muted">
                  importance {a.importance}/5, evidence {a.evidence}/5
                  {a.willingnessToChange != null && <>, willingness to change {a.willingnessToChange}/10</>}
                </span>
                <SeedFlag tags={a.tags} />
              </div>
              <div className="mt-2 text-sm font-medium">{a.statement}</div>
              {a.experiments.length > 0 && (
                <div className="mt-2 text-xs text-muted">Tested by: {a.experiments.map(({ experiment: e }) => experimentName(e)).join(", ")}</div>
              )}
              {a.history.length > 0 && (
                <div className="mt-1 text-xs text-muted">
                  Last change {fmtDate(a.history[a.history.length - 1].createdAt)}
                  {a.history[a.history.length - 1].note && `: ${a.history[a.history.length - 1].note}`}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
