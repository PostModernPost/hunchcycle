// Loads experiments in the shape the board and drawer need. Server only.
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

async function query(id?: string) {
  const rows = await db.query.experiments.findMany({
    where: id ? eq(s.experiments.id, id) : undefined,
    with: {
      assumptions: { with: { assumption: true } },
      metrics: { with: { readings: { orderBy: (r, { asc }) => [asc(r.date)] } }, orderBy: (m, { asc }) => [asc(m.order)] },
      runs: { with: { run: { with: { evidence: true } } } },
      comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] },
    },
    orderBy: (e, { asc }) => [asc(e.createdAt)],
  });
  const history = await db
    .select()
    .from(s.assumptionHistory)
    .where(id ? eq(s.assumptionHistory.experimentId, id) : undefined);

  return rows.map(({ assumptions, runs, ...e }) => {
    const own = history.filter((h) => h.experimentId === e.id);
    return {
      ...e,
      assumptions: assumptions.map((x) => x.assumption),
      runs: runs.map((x) => x.run),
      history: own,
      updatedAssumptionIds: [...new Set(own.map((h) => h.assumptionId))],
    };
  });
}

export const loadCards = () => query();
export const loadCard = async (id: string) => (await query(id))[0] ?? null;

export type BoardCard = Awaited<ReturnType<typeof loadCards>>[number];
