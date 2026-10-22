import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function count(table: any) {
  const [row] = await db.execute(sql`select count(*)::int as n from ${table}`);
  return Number(row.n);
}

export default async function Home() {
  const [experiments, assumptions, runs, people, interviews, scripts, questions] = await Promise.all([
    count(s.experiments),
    count(s.assumptions),
    count(s.runs),
    count(s.people),
    count(s.interviews),
    count(s.scripts),
    count(s.questions),
  ]);
  const openQs = await db.select().from(s.openQuestions);

  const tiles = [
    { href: "/experiments", label: "Experiments", n: experiments },
    { href: "/assumptions", label: "Assumptions", n: assumptions },
    { href: "/runs", label: "Runs", n: runs },
    { href: "/people", label: "People", n: people, sub: `${interviews} interviews and survey responses` },
    { href: "/scripts", label: "Scripts", n: scripts, sub: `${questions} questions in the bank` },
  ];

  return (
    <div>
      <PageTitle title="Play Action" sub="Milestone 1: seeded data, read-only. Check that everything from the coaching doc and spreadsheet made it in." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.href} href={t.href}>
            <div className="text-3xl font-semibold">{t.n}</div>
            <div className="text-sm font-medium">{t.label}</div>
            {t.sub && <div className="mt-1 text-xs text-muted">{t.sub}</div>}
          </Card>
        ))}
      </div>
      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Open questions</h2>
      <Card>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {openQs.map((q) => (
            <li key={q.id}>{q.text}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
