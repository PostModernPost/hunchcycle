import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Card, PageTitle, Pill } from "@/components/ui";
import { PersonForm } from "@/components/people/PersonForm";
import { fmtDate, HEAT_STYLES } from "@/lib/format";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.query.people.findFirst({
    where: eq(s.people.id, id),
    with: { interviews: { with: { script: true, evidence: { with: { run: true } } }, orderBy: (i, { asc }) => [asc(i.date)] } },
  });
  if (!p) notFound();
  const { interviews, ...person } = p;
  const isOwner = (await getRole()) === "owner";

  return (
    <div className="max-w-3xl">
      <Link href="/people" className="text-sm text-muted hover:text-ink">
        ← People
      </Link>
      <PageTitle title={p.name} sub={`${interviews.length} interview${interviews.length === 1 ? "" : "s"} or survey response${interviews.length === 1 ? "" : "s"}`} />

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Interviews</h2>
      <div className="mb-2 space-y-2">
        {interviews.map((i) => (
          <Card key={i.id} href={`/interviews/${i.id}`} className="p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{fmtDate(i.date) || "No date"}</span>
              <span className="text-muted">{i.evidence.run.name}</span>
              {i.script && (
                <Pill>
                  {i.script.name} {i.script.versionLabel}
                </Pill>
              )}
              {i.coldHot && <Pill className={HEAT_STYLES[i.coldHot]}>{i.coldHot}</Pill>}
              {i.score != null && (
                <Pill className={i.scoreSource === "guessed" ? "bg-yellow-100 text-yellow-800" : ""}>
                  {i.score}/10{i.scoreSource === "guessed" ? " guessed, unverified" : ""}
                </Pill>
              )}
            </div>
            {i.problem && <div className="mt-1 line-clamp-2 text-sm text-muted">{i.problem}</div>}
          </Card>
        ))}
      </div>
      {isOwner && (
        <Link href={`/interviews/new?person=${p.id}`} className="text-sm text-accent hover:brightness-110">
          + New interview with {p.name}
        </Link>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Details</h2>
      <Card>
        <PersonForm person={person} />
      </Card>
    </div>
  );
}
