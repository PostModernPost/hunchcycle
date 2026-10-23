import { db, schema as s } from "@/db";
import { desc } from "drizzle-orm";
import { Card, PageTitle } from "@/components/ui";
import { OpenQuestions } from "@/components/briefs/BriefControls";
import { inputCls } from "@/components/styles";
import { defaultRange } from "@/lib/brief";
import { dateInput, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [briefs, questions, range] = await Promise.all([
    db.query.weeklyBriefs.findMany({ orderBy: [desc(s.weeklyBriefs.rangeEnd)] }),
    db.select().from(s.openQuestions).orderBy(desc(s.openQuestions.createdAt)),
    defaultRange(),
  ]);
  const counts = await db.query.comments.findMany({ columns: { briefId: true } });
  const commentCount = (id: string) => counts.filter((c) => c.briefId === id).length;

  return (
    <div className="max-w-3xl">
      <PageTitle title="Weekly brief" sub="What changed since the last brief: moves, decisions, assumption changes, readings, and what is due next." />
      <Card className="mb-6">
        <form method="get" action="/briefs/preview" className="flex flex-wrap items-end gap-2 text-sm">
          <label>
            <span className="mb-1 block text-xs text-muted">From</span>
            <input type="date" name="from" defaultValue={dateInput(range.from)} className={`${inputCls.replace("w-full ", "")} w-44`} />
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted">To</span>
            <input type="date" name="to" defaultValue={dateInput(range.to)} className={`${inputCls.replace("w-full ", "")} w-44`} />
          </label>
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-paper hover:brightness-110">
            Make the brief
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{briefs.length ? "Starts where the last saved brief ended." : "Starts 7 days ago, since there is no saved brief yet."}</p>
      </Card>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Saved briefs</h2>
      {briefs.length === 0 && <p className="mb-6 text-sm text-muted">None yet. Make one above, then save it.</p>}
      <div className="mb-8 space-y-2">
        {briefs.map((b) => (
          <Card key={b.id} href={`/briefs/${b.id}`} className="p-3 text-sm">
            <span className="font-medium">
              {fmtDate(b.rangeStart)} to {fmtDate(b.rangeEnd)}
            </span>
            <span className="ml-2 text-muted">
              {commentCount(b.id)} comment{commentCount(b.id) === 1 ? "" : "s"}
            </span>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Open questions</h2>
      <Card>
        <OpenQuestions questions={questions} />
      </Card>
    </div>
  );
}
