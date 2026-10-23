import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageTitle } from "@/components/ui";
import { BriefView } from "@/components/briefs/BriefView";
import { Comments } from "@/components/Comments";
import type { BriefContent } from "@/lib/brief";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SavedBrief({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.query.weeklyBriefs.findFirst({ where: eq(s.weeklyBriefs.id, id) });
  if (!b) notFound();
  const comments = await db.query.comments.findMany({ where: eq(s.comments.briefId, id), orderBy: (c, { asc }) => [asc(c.createdAt)] });
  return (
    <div className="max-w-3xl">
      <Link href="/briefs" className="text-sm text-muted hover:text-ink">
        ← Weekly brief
      </Link>
      <PageTitle title={`Brief: ${fmtDate(b.rangeStart)} to ${fmtDate(b.rangeEnd)}`} sub={`Saved ${fmtDate(b.createdAt)}. This is a snapshot, so it reads the same later.`} />
      <BriefView brief={b.content as BriefContent} />
      <div className="mt-6">
        <Comments comments={comments} briefId={b.id} />
      </div>
    </div>
  );
}
