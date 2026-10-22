import Link from "next/link";
import { db } from "@/db";
import { PageTitle, Pill } from "@/components/ui";
import { fmtDate, HEAT_STYLES } from "@/lib/format";
import { NewPerson, ScoreSummary } from "@/components/people/PersonForm";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const rows = await db.query.people.findMany({
    with: { interviews: { with: { script: true } } },
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });
  const scored = rows.flatMap((p) => p.interviews).filter((i) => i.score != null);

  return (
    <div>
      <PageTitle title="People" sub="Each person is stored once. Their interviews and survey responses stack under them." />
      <div className="mb-3">
        <NewPerson />
      </div>
      <ScoreSummary asked={scored.filter((i) => i.scoreSource !== "guessed").map((i) => i.score!)} guessed={scored.filter((i) => i.scoreSource === "guessed").map((i) => i.score!)} />
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Age</th>
              <th className="px-3 py-2">Found via</th>
              <th className="px-3 py-2">Segments</th>
              <th className="px-3 py-2">Interviews</th>
              <th className="px-3 py-2">Heat</th>
              <th className="px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const last = p.interviews[p.interviews.length - 1];
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/people/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.age}</td>
                  <td className="px-3 py-2 text-muted">{p.channelFound}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.segments.map((s) => (
                        <Pill key={s}>{s}</Pill>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {p.interviews.map((i) => (
                      <Link key={i.id} href={`/interviews/${i.id}`} className="block hover:underline">
                        {fmtDate(i.date)} {i.script ? `(${i.script.name} ${i.script.versionLabel})` : ""}
                      </Link>
                    ))}
                  </td>
                  <td className="px-3 py-2">{last?.coldHot && <Pill className={HEAT_STYLES[last.coldHot]}>{last.coldHot}</Pill>}</td>
                  <td className="px-3 py-2">
                    {last?.score != null && (
                      <span>
                        {last.score}
                        {last.scoreSource === "guessed" && <Pill className="ml-1 bg-yellow-100 text-yellow-800">guessed, unverified</Pill>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
