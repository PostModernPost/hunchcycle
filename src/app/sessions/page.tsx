import Link from "next/link";
import { db } from "@/db";
import { Card, PageTitle, Pill } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const rows = await db.query.runs.findMany({
    with: {
      experiments: { with: { experiment: true } },
      evidence: { with: { interview: { with: { person: true } } } },
    },
  });
  rows.sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity));

  return (
    <div className="max-w-4xl">
      <PageTitle title="Sessions" sub="Each time you went out and collected evidence, like an event night or a day of interviews. One session can serve several experiments." />
      <div className="space-y-3">
        {rows.map((r) => {
          const interviews = r.evidence.filter((e) => e.interview);
          const other = r.evidence.filter((e) => !e.interview);
          return (
            <Card key={r.id} className="scroll-mt-4">
              <div id={r.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted">
                  {fmtDate(r.startDate)}
                  {r.endDate && <> to {fmtDate(r.endDate)}</>}
                  {r.location && <> · {r.location}</>}
                </div>
              </div>
              {r.notes && <div className="mt-1 text-sm text-muted">{r.notes}</div>}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.experiments.map(({ experiment: e }) => (
                  <Link key={e.id} href={`/experiments/${e.id}`}>
                    <Pill className="bg-orange-50 text-orange-900 hover:bg-orange-100">{e.title}</Pill>
                  </Link>
                ))}
                {r.experiments.length > 1 && !r.interferenceChecked && (
                  <Pill className="bg-yellow-100 text-yellow-800">serves {r.experiments.length} experiments: interference not checked</Pill>
                )}
              </div>
              {interviews.length > 0 && (
                <div className="mt-3 text-sm">
                  <span className="text-muted">{interviews.length} interview{interviews.length === 1 ? "" : "s"}: </span>
                  {interviews.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && ", "}
                      <Link href={`/interviews/${e.interview!.id}`} className="hover:underline">
                        {e.interview!.person.name}
                      </Link>
                    </span>
                  ))}
                </div>
              )}
              {other.map((e) => (
                <div key={e.id} className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">
                  <Pill>{e.type}</Pill> {e.summary}
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
