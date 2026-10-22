import Link from "next/link";
import { db } from "@/db";
import { Card, PageTitle, Pill, SeedFlag } from "@/components/ui";
import { experimentName, fmtDate, STATUS_STYLES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssumptionsPage() {
  const rows = await db.query.assumptions.findMany({
    with: {
      experiments: { with: { experiment: { with: { type: true } } } },
      history: { with: { experiment: { with: { type: true } } }, orderBy: (h, { asc }) => [asc(h.createdAt)] },
    },
  });
  // riskiest first: high importance, low evidence
  rows.sort((a, b) => b.importance - b.evidence - (a.importance - a.evidence) || b.importance - a.importance);

  return (
    <div className="max-w-4xl">
      <PageTitle title="Assumptions" sub="Sorted riskiest first (high importance, little evidence). The 2x2 map comes in milestone 4." />
      <div className="space-y-3">
        {rows.map((a) => (
          <Card key={a.id} className="scroll-mt-4">
            <div id={a.id} className="flex flex-wrap items-center gap-2">
              <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
              <Pill>{a.category}</Pill>
              <span className="text-xs text-muted">
                importance {a.importance}/5 · evidence {a.evidence}/5
                {a.willingnessToChange != null && <> · willingness to change {a.willingnessToChange}/10</>}
              </span>
              <SeedFlag tags={a.tags} />
            </div>
            <div className="mt-2 text-sm font-medium">{a.statement}</div>
            {a.notes && <div className="mt-1 text-sm text-muted">{a.notes}</div>}
            {a.experiments.length > 0 && (
              <div className="mt-3 text-xs">
                <span className="text-muted">Tested by: </span>
                {a.experiments.map(({ experiment: e }, i) => (
                  <span key={e.id}>
                    {i > 0 && ", "}
                    <Link href={`/experiments/${e.id}`} className="hover:underline">
                      {experimentName(e)}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            {a.history.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                {a.history.map((h) => (
                  <li key={h.id}>
                    {fmtDate(h.createdAt)}
                    {h.toStatus && <> · now {h.toStatus}</>}
                    {h.experiment && <> · {experimentName(h.experiment)}</>}: {h.note}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
