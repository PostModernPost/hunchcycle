import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { BriefView } from "@/components/briefs/BriefView";
import { SaveBrief } from "@/components/briefs/BriefControls";
import { buildBrief, defaultRange } from "@/lib/brief";
import { parseRange } from "@/lib/brief-range";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BriefPreview({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const p = await searchParams;
  const { from, to } = parseRange(p.from, p.to, await defaultRange());
  const brief = await buildBrief(from, to);
  return (
    <div className="max-w-3xl">
      <Link href="/briefs" className="text-sm text-muted hover:text-ink">
        ← Weekly brief
      </Link>
      <PageTitle title={`Brief: ${fmtDate(from)} to ${fmtDate(to)}`} sub="This is live. Save it to keep a snapshot the coach can comment on." />
      <div className="mb-4">
        <SaveBrief from={from.toISOString()} to={to.toISOString()} />
      </div>
      <BriefView brief={brief} />
    </div>
  );
}
