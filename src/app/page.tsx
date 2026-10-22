import { db, schema as s } from "@/db";
import { loadCards } from "@/lib/board-data";
import { Board } from "@/components/board/Board";

export const dynamic = "force-dynamic";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ card?: string; view?: string }> }) {
  const { card, view } = await searchParams;
  const [cards, assumptions, runs, scripts, types] = await Promise.all([
    loadCards(),
    db
      .select({
        id: s.assumptions.id,
        statement: s.assumptions.statement,
        status: s.assumptions.status,
        category: s.assumptions.category,
        importance: s.assumptions.importance,
        evidence: s.assumptions.evidence,
      })
      .from(s.assumptions),
    db.select({ id: s.runs.id, name: s.runs.name, startDate: s.runs.startDate }).from(s.runs),
    db.select({ id: s.scripts.id, name: s.scripts.name, versionLabel: s.scripts.versionLabel }).from(s.scripts),
    db.select({ id: s.experimentTypes.id, name: s.experimentTypes.name, needsScript: s.experimentTypes.needsScript }).from(s.experimentTypes).orderBy(s.experimentTypes.name),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Board</h1>
      <Board cards={cards} lists={{ assumptions, runs, scripts, types }} initialOpen={card} initialView={view === "assumptions" ? "assumptions" : "list"} />
    </div>
  );
}
