// Shows a weekly brief (live preview or saved snapshot). Server component.
import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import type { BriefContent } from "@/lib/brief";
import { fmtDate } from "@/lib/format";

export function BriefView({ brief: b }: { brief: BriefContent }) {
  return (
    <div className="space-y-4">
      <Block title="Decisions made" empty="No sprints were closed in this range." items={b.decisions}>
        {(d) => (
          <>
            <Link href={`/sprints/${d.sprintId}`} className="font-medium hover:underline">
              {d.name}
            </Link>
            : <span className="font-semibold capitalize">{d.decision}</span>
            {d.note && <span className="text-muted">. {d.note}</span>}
            <When at={d.at} />
          </>
        )}
      </Block>

      <Block title="Assumptions whose evidence or status changed" empty="No assumption changed in this range." items={b.assumptionChanges}>
        {(a) => (
          <>
            <Link href={`/assumptions/${a.assumptionId}`} className="hover:underline">
              {a.statement}
            </Link>
            <div className="text-xs text-muted">
              <span className="font-medium text-ink">{a.change}</span>
              {a.sprint && <> in {a.sprint}</>}
              {a.note && <>. {a.note}</>}
              <When at={a.at} />
            </div>
          </>
        )}
      </Block>

      <Block title="Sprints that moved columns" empty="No moves recorded in this range. (Moves are recorded from Oct 22, 2026 on.)" items={b.moved}>
        {(m) => (
          <>
            <Link href={`/sprints/${m.sprintId}`} className="font-medium hover:underline">
              {m.name}
            </Link>{" "}
            moved from {m.from} to {m.to}
            <When at={m.at} />
          </>
        )}
      </Block>

      <Block title="New sprints" empty="No new sprints in this range." items={b.started}>
        {(x) => (
          <>
            <Link href={`/sprints/${x.sprintId}`} className="font-medium hover:underline">
              {x.name}
            </Link>
            <When at={x.at} />
          </>
        )}
      </Block>

      <Block title="Metric readings added" empty="No readings in this range." items={b.readings}>
        {(r) => (
          <>
            <span className="text-muted">{r.sprint}, </span>
            {r.metric}: <span className="font-medium">{r.value}</span>
            {!r.verified && <Pill className="ml-2 bg-yellow-100 text-yellow-800">unverified</Pill>}
            <When at={r.at} />
          </>
        )}
      </Block>

      <Block title="Sessions held" empty="No sessions in this range." items={b.sessions}>
        {(x) => (
          <>
            <Link href={`/sessions#${x.sessionId}`} className="hover:underline">
              {x.name}
            </Link>
            <span className="text-muted">
              , {x.evidence} piece{x.evidence === 1 ? "" : "s"} of evidence
            </span>
            <When at={x.at} />
          </>
        )}
      </Block>

      <Block title="Past their report date" empty="Nothing running is past its report date." items={b.stale} warn>
        {(x) => (
          <>
            <Link href={`/sprints/${x.sprintId}`} className="font-medium hover:underline">
              {x.name}
            </Link>
            <span className="text-muted">, report was due {fmtDate(x.reportDate)}</span>
          </>
        )}
      </Block>

      <Block title="Due next week" empty="No report dates in the next 7 days." items={b.dueNext}>
        {(x) => (
          <>
            <Link href={`/sprints/${x.sprintId}`} className="font-medium hover:underline">
              {x.name}
            </Link>
            <span className="text-muted">, report due {fmtDate(x.reportDate)}</span>
          </>
        )}
      </Block>

      <Block title="Open questions" empty="No open questions." items={b.openQuestions}>
        {(q) => <>{q.text}</>}
      </Block>
    </div>
  );
}

function Block<T>({ title, empty, items, warn, children }: { title: string; empty: string; items: T[]; warn?: boolean; children: (item: T) => React.ReactNode }) {
  return (
    <Card>
      <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${warn && items.length ? "text-red-700" : "text-muted"}`}>
        {title} {items.length > 0 && <span className="font-normal">({items.length})</span>}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((x, i) => (
            <li key={i}>{children(x)}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function When({ at }: { at: string }) {
  return <span className="ml-2 text-xs text-muted">{fmtDate(at)}</span>;
}
