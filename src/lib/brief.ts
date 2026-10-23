// Builds the weekly brief for a date range (BRIEF section 6.6). The result is plain data, so a saved
// brief is a snapshot: it reads the same later even if sprints are renamed or moved. Server only.
import { and, desc, gte, isNotNull, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { experimentName, STAGE_LABELS, pct } from "@/lib/format";
import { flowStage, isStale } from "@/lib/gates";

export type BriefContent = {
  from: string;
  to: string;
  moved: { sprintId: string; name: string; from: string; to: string; at: string }[];
  started: { sprintId: string; name: string; at: string }[];
  decisions: { sprintId: string; name: string; decision: string; note: string | null; at: string }[];
  assumptionChanges: { assumptionId: string; statement: string; change: string; note: string | null; sprint: string | null; at: string }[];
  readings: { sprintId: string; sprint: string; metric: string; value: string; verified: boolean; at: string }[];
  sessions: { sessionId: string; name: string; at: string; evidence: number }[];
  stale: { sprintId: string; name: string; reportDate: string }[];
  dueNext: { sprintId: string; name: string; reportDate: string }[];
  openQuestions: { id: string; text: string }[];
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();

/** Brief covering [from, to). `to` is usually now. */
export async function buildBrief(from: Date, to: Date): Promise<BriefContent> {
  const inRange = <T extends { getTime(): number }>(d: T | null | undefined) => !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();
  const [sprints, moves, history, readings, runs, questions] = await Promise.all([
    db.query.experiments.findMany({ with: { type: true } }),
    db.query.stageChanges.findMany({ where: and(gte(s.stageChanges.createdAt, from), lt(s.stageChanges.createdAt, to)), orderBy: (c, { asc }) => [asc(c.createdAt)] }),
    db.query.assumptionHistory.findMany({
      where: and(gte(s.assumptionHistory.createdAt, from), lt(s.assumptionHistory.createdAt, to)),
      with: { assumption: true, experiment: { with: { type: true } } },
      orderBy: (h, { asc }) => [asc(h.createdAt)],
    }),
    db.query.metricReadings.findMany({
      where: and(gte(s.metricReadings.date, from), lt(s.metricReadings.date, to)),
      with: { metric: { with: { experiment: { with: { type: true } } } } },
      orderBy: (r, { asc }) => [asc(r.date)],
    }),
    db.query.runs.findMany({ where: and(isNotNull(s.runs.startDate), gte(s.runs.startDate, from), lt(s.runs.startDate, to)), with: { evidence: { columns: { id: true } } } }),
    db.select().from(s.openQuestions).orderBy(desc(s.openQuestions.createdAt)),
  ]);
  const byId = new Map(sprints.map((e) => [e.id, e]));
  const name = (id: string) => {
    const e = byId.get(id);
    return e ? experimentName(e) : "A deleted sprint";
  };
  const label = (stage: string) => STAGE_LABELS[flowStage(stage as never)] ?? stage;

  return {
    from: iso(from),
    to: iso(to),
    moved: moves.map((m) => ({ sprintId: m.experimentId, name: name(m.experimentId), from: label(m.fromStage), to: label(m.toStage), at: iso(m.createdAt) })),
    started: sprints.filter((e) => inRange(e.createdAt)).map((e) => ({ sprintId: e.id, name: experimentName(e), at: iso(e.createdAt) })),
    decisions: sprints
      .filter((e) => e.stage === "closed" && inRange(e.closedAt) && e.decision)
      .map((e) => ({ sprintId: e.id, name: experimentName(e), decision: e.decision!, note: e.decisionNote, at: iso(e.closedAt!) })),
    assumptionChanges: history.map((h) => {
      const parts = [
        h.fromEvidence != null && h.toEvidence != null && h.fromEvidence !== h.toEvidence && `evidence ${h.fromEvidence} to ${h.toEvidence}`,
        h.toStatus && h.fromStatus !== h.toStatus && (h.fromStatus ? `${h.fromStatus} to ${h.toStatus}` : `now ${h.toStatus}`),
      ].filter(Boolean);
      return {
        assumptionId: h.assumptionId,
        statement: h.assumption.statement,
        change: parts.join(", ") || "noted",
        note: h.note,
        sprint: h.experiment ? experimentName(h.experiment) : null,
        at: iso(h.createdAt),
      };
    }),
    readings: readings.map((r) => ({
      sprintId: r.metric.experimentId,
      sprint: experimentName(r.metric.experiment),
      metric: r.metric.name,
      value: r.numerator != null && r.denominator != null ? `${r.numerator} of ${r.denominator} (${pct(r.numerator, r.denominator)})` : String(r.value ?? ""),
      verified: r.verified,
      at: iso(r.date),
    })),
    sessions: runs
      .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
      .map((r) => ({ sessionId: r.id, name: r.name, at: iso(r.startDate!), evidence: r.evidence.length })),
    stale: sprints.filter((e) => isStale(e, to)).map((e) => ({ sprintId: e.id, name: experimentName(e), reportDate: iso(e.reportDate!) })),
    dueNext: sprints
      .filter((e) => e.stage !== "closed" && e.reportDate && e.reportDate.getTime() >= to.getTime() && e.reportDate.getTime() < to.getTime() + 7 * DAY)
      .map((e) => ({ sprintId: e.id, name: experimentName(e), reportDate: iso(e.reportDate!) })),
    openQuestions: questions.filter((q) => !q.resolved).map((q) => ({ id: q.id, text: q.text })),
  };
}

/** Default range: since the last saved brief ended, or the last 7 days if there is none. */
export async function defaultRange(now = new Date()): Promise<{ from: Date; to: Date }> {
  const [last] = await db.select().from(s.weeklyBriefs).orderBy(desc(s.weeklyBriefs.rangeEnd)).limit(1);
  return { from: last ? last.rangeEnd : new Date(now.getTime() - 7 * DAY), to: now };
}
