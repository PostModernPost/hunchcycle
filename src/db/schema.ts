// Hunchcycle data model. See BRIEF.md section 3.
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const textArray = (name: string) =>
  text(name).array().notNull().default(sql`'{}'::text[]`);

// ---------- Enums ----------

export const assumptionCategory = pgEnum("assumption_category", [
  "customer",
  "problem",
  "solution",
  "channel",
  "revenue",
  "other",
]);
export const assumptionStatus = pgEnum("assumption_status", [
  "untested",
  "testing",
  "supported",
  "refuted",
  "retired",
]);
export const STAGES = [
  "assumption",
  "hypothesis",
  "experiment",
  "metrics",
  "running",
  "results",
  "decision",
  "closed",
] as const;
export const stage = pgEnum("stage", STAGES);
export const method = pgEnum("method", [
  "interviews",
  "survey",
  "pilot",
  "landing_page",
  "event",
  "concierge",
  "other",
]);
export const decision = pgEnum("decision", ["persevere", "pivot", "kill"]);
export const metricType = pgEnum("metric_type", ["rate", "count", "score"]);
export const metricResult = pgEnum("metric_result", ["pass", "fail", "unclear"]);
export const evidenceType = pgEnum("evidence_type", [
  "interview",
  "observation",
  "metric_reading",
  "survey_response",
  "other",
]);
export const coldHot = pgEnum("cold_hot", ["cold", "warm", "hot"]);
export const scoreSource = pgEnum("score_source", ["asked", "guessed"]);
export const asked = pgEnum("asked", ["yes", "no", "not_recorded"]);
export const role = pgEnum("role", ["owner", "coach"]);

// ---------- Assumptions ----------

export const assumptions = pgTable("assumptions", {
  id: id(),
  statement: text("statement").notNull(),
  category: assumptionCategory("category").notNull().default("other"),
  importance: integer("importance").notNull().default(3), // 1-5
  evidence: integer("evidence").notNull().default(1), // 1-5
  willingnessToChange: integer("willingness_to_change"), // 1-10
  status: assumptionStatus("status").notNull().default("untested"),
  notes: text("notes"),
  tags: textArray("tags"),
  parentId: text("parent_id"),
  // set when the assumption came out of a sprint's results; the next sprint starts with it (BRIEF section 4, loop back)
  spawnedByExperimentId: text("spawned_by_experiment_id").references((): AnyPgColumn => experiments.id, { onDelete: "set null" }),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assumptionHistory = pgTable("assumption_history", {
  id: id(),
  assumptionId: text("assumption_id")
    .notNull()
    .references(() => assumptions.id, { onDelete: "cascade" }),
  experimentId: text("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
  fromEvidence: integer("from_evidence"),
  toEvidence: integer("to_evidence"),
  fromStatus: assumptionStatus("from_status"),
  toStatus: assumptionStatus("to_status"),
  note: text("note"),
  createdAt: created(),
});

// ---------- Experiments (board rows) ----------

/** Kinds of test (Customer Interviews, Marketing, ...). Adam can add more. Replaces `method` in the UI. */
export const experimentTypes = pgTable("experiment_types", {
  id: id(),
  name: text("name").notNull().unique(),
  needsScript: boolean("needs_script").notNull().default(false), // interviews and surveys need a script
  createdAt: created(),
});

export const experiments = pgTable("experiments", {
  id: id(),
  // Shown as "<type> <cycleNumber>", e.g. "Customer Interviews 2". `title` is the optional subtitle / MVP name.
  typeId: text("type_id").references(() => experimentTypes.id, { onDelete: "set null" }),
  cycleNumber: integer("cycle_number"),
  title: text("title"),
  stage: stage("stage").notNull().default("assumption"),
  // hypothesis
  who: text("who"),
  action: text("action"),
  howMany: text("how_many"),
  byWhen: text("by_when"),
  becauseNote: text("because_note"),
  // design (method is kept for old data; the type replaced it in the UI)
  method: method("method"),
  channel: text("channel"),
  sampleSizeTarget: integer("sample_size_target"),
  startDate: timestamp("start_date", { withTimezone: true }),
  reportDate: timestamp("report_date", { withTimezone: true }),
  scriptId: text("script_id").references(() => scripts.id, { onDelete: "set null" }),
  // results and decision
  rawLearnings: text("raw_learnings"),
  insights: text("insights"),
  decision: decision("decision"),
  decisionNote: text("decision_note"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  siblingGroup: text("sibling_group"),
  tags: textArray("tags"),
  notes: text("notes"),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const experimentAssumptions = pgTable(
  "experiment_assumptions",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    assumptionId: text("assumption_id")
      .notNull()
      .references(() => assumptions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.assumptionId] })],
);

export const metrics = pgTable("metrics", {
  id: id(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  name: text("name").notNull(),
  type: metricType("type").notNull().default("rate"),
  source: text("source"),
  passLine: text("pass_line"),
  passDecision: text("pass_decision"),
  killLine: text("kill_line"),
  killDecision: text("kill_decision"),
  result: metricResult("result"),
});

export const metricReadings = pgTable("metric_readings", {
  id: id(),
  metricId: text("metric_id")
    .notNull()
    .references(() => metrics.id, { onDelete: "cascade" }),
  value: doublePrecision("value"),
  numerator: integer("numerator"),
  denominator: integer("denominator"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
  verified: boolean("verified").notNull().default(false),
});

// ---------- Runs and evidence ----------

export const runs = pgTable("runs", {
  id: id(),
  name: text("name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  location: text("location"),
  runBy: text("run_by"),
  notes: text("notes"),
  recordingLinks: textArray("recording_links"),
  interferenceChecked: boolean("interference_checked").notNull().default(false),
  interferenceNote: text("interference_note"),
  createdAt: created(),
});

export const experimentRuns = pgTable(
  "experiment_runs",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.runId] })],
);

export const evidence = pgTable("evidence", {
  id: id(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  type: evidenceType("type").notNull().default("observation"),
  summary: text("summary"),
  links: textArray("links"),
  createdAt: created(),
});

export const evidenceMetrics = pgTable(
  "evidence_metrics",
  {
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
    metricId: text("metric_id")
      .notNull()
      .references(() => metrics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.evidenceId, t.metricId] })],
);

export const readingEvidence = pgTable(
  "reading_evidence",
  {
    readingId: text("reading_id")
      .notNull()
      .references(() => metricReadings.id, { onDelete: "cascade" }),
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.readingId, t.evidenceId] })],
);

// ---------- People and interviews ----------

export const people = pgTable("people", {
  id: id(),
  name: text("name").notNull(),
  gender: text("gender"),
  age: integer("age"),
  location: text("location"),
  contact: text("contact"),
  channelFound: text("channel_found"),
  platform: text("platform"),
  fantasy: text("fantasy"),
  bettor: text("bettor"),
  whereToFindOthers: text("where_to_find_others"),
  notes: text("notes"),
  segments: textArray("segments"),
  createdAt: created(),
});

export const interviews = pgTable("interviews", {
  id: id(),
  evidenceId: text("evidence_id")
    .notNull()
    .unique()
    .references(() => evidence.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }),
  interviewers: text("interviewers"),
  recordingDevice: text("recording_device"),
  scriptId: text("script_id").references(() => scripts.id, { onDelete: "set null" }),
  problem: text("problem"),
  persona: text("persona"),
  surprise: text("surprise"),
  bestQuote: text("best_quote"),
  questionThatGotQuote: text("question_that_got_quote"),
  comments: text("comments"),
  observation: text("observation"),
  insights: text("insights"),
  stage: text("stage"),
  coldHot: coldHot("cold_hot"),
  coldHotNote: text("cold_hot_note"),
  nextAction: text("next_action"),
  sale: text("sale"),
  method: text("method"),
  solution: text("solution"),
  score: integer("score"),
  scoreSource: scoreSource("score_source"),
  scoreNote: text("score_note"),
  transcriptText: text("transcript_text"),
  summaryText: text("summary_text"),
  createdAt: created(),
});

export const questions = pgTable("questions", {
  id: id(),
  text: text("text").notNull(),
  tags: textArray("tags"),
  createdAt: created(),
});

export const scripts = pgTable("scripts", {
  id: id(),
  name: text("name").notNull(),
  versionLabel: text("version_label").notNull().default("v1"),
  parentId: text("parent_id"),
  notes: text("notes"),
  createdAt: created(),
});

export const scriptQuestions = pgTable(
  "script_questions",
  {
    id: id(),
    scriptId: text("script_id")
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    wordingOverride: text("wording_override"),
  },
  (t) => [unique().on(t.scriptId, t.questionId)],
);

export const answers = pgTable(
  "answers",
  {
    id: id(),
    interviewId: text("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text"),
    asked: asked("asked").notNull().default("not_recorded"),
  },
  (t) => [unique().on(t.interviewId, t.questionId)],
);

// ---------- Coaching layer ----------

export const weeklyBriefs = pgTable("weekly_briefs", {
  id: id(),
  rangeStart: timestamp("range_start", { withTimezone: true }).notNull(),
  rangeEnd: timestamp("range_end", { withTimezone: true }).notNull(),
  content: jsonb("content").notNull(),
  createdAt: created(),
});

export const comments = pgTable("comments", {
  id: id(),
  experimentId: text("experiment_id").references(() => experiments.id, { onDelete: "cascade" }),
  briefId: text("brief_id").references(() => weeklyBriefs.id, { onDelete: "cascade" }),
  role: role("role").notNull(),
  authorName: text("author_name"),
  body: text("body").notNull(),
  createdAt: created(),
});

/** Every column change on the board, for the weekly brief's "moved columns" section. */
export const stageChanges = pgTable("stage_changes", {
  id: id(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  fromStage: stage("from_stage").notNull(),
  toStage: stage("to_stage").notNull(),
  createdAt: created(),
});

export const openQuestions = pgTable("open_questions", {
  id: id(),
  text: text("text").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: created(),
});

// ---------- Relations (for relational queries) ----------

export const assumptionsRelations = relations(assumptions, ({ many, one }) => ({
  experiments: many(experimentAssumptions),
  history: many(assumptionHistory),
  parent: one(assumptions, { fields: [assumptions.parentId], references: [assumptions.id], relationName: "parent" }),
  children: many(assumptions, { relationName: "parent" }),
  spawnedBy: one(experiments, { fields: [assumptions.spawnedByExperimentId], references: [experiments.id], relationName: "spawned" }),
}));
export const assumptionHistoryRelations = relations(assumptionHistory, ({ one }) => ({
  assumption: one(assumptions, { fields: [assumptionHistory.assumptionId], references: [assumptions.id] }),
  experiment: one(experiments, { fields: [assumptionHistory.experimentId], references: [experiments.id] }),
}));
export const experimentTypesRelations = relations(experimentTypes, ({ many }) => ({
  experiments: many(experiments),
}));
export const experimentsRelations = relations(experiments, ({ many, one }) => ({
  type: one(experimentTypes, { fields: [experiments.typeId], references: [experimentTypes.id] }),
  spawned: many(assumptions, { relationName: "spawned" }),
  assumptions: many(experimentAssumptions),
  metrics: many(metrics),
  runs: many(experimentRuns),
  comments: many(comments),
  script: one(scripts, { fields: [experiments.scriptId], references: [scripts.id] }),
}));
export const experimentAssumptionsRelations = relations(experimentAssumptions, ({ one }) => ({
  experiment: one(experiments, { fields: [experimentAssumptions.experimentId], references: [experiments.id] }),
  assumption: one(assumptions, { fields: [experimentAssumptions.assumptionId], references: [assumptions.id] }),
}));
export const metricsRelations = relations(metrics, ({ one, many }) => ({
  experiment: one(experiments, { fields: [metrics.experimentId], references: [experiments.id] }),
  readings: many(metricReadings),
  evidence: many(evidenceMetrics),
}));
export const metricReadingsRelations = relations(metricReadings, ({ one, many }) => ({
  metric: one(metrics, { fields: [metricReadings.metricId], references: [metrics.id] }),
  evidence: many(readingEvidence),
}));
export const readingEvidenceRelations = relations(readingEvidence, ({ one }) => ({
  reading: one(metricReadings, { fields: [readingEvidence.readingId], references: [metricReadings.id] }),
  evidence: one(evidence, { fields: [readingEvidence.evidenceId], references: [evidence.id] }),
}));
export const evidenceMetricsRelations = relations(evidenceMetrics, ({ one }) => ({
  evidence: one(evidence, { fields: [evidenceMetrics.evidenceId], references: [evidence.id] }),
  metric: one(metrics, { fields: [evidenceMetrics.metricId], references: [metrics.id] }),
}));
export const runsRelations = relations(runs, ({ many }) => ({
  experiments: many(experimentRuns),
  evidence: many(evidence),
}));
export const experimentRunsRelations = relations(experimentRuns, ({ one }) => ({
  experiment: one(experiments, { fields: [experimentRuns.experimentId], references: [experiments.id] }),
  run: one(runs, { fields: [experimentRuns.runId], references: [runs.id] }),
}));
export const evidenceRelations = relations(evidence, ({ one, many }) => ({
  run: one(runs, { fields: [evidence.runId], references: [runs.id] }),
  interview: one(interviews, { fields: [evidence.id], references: [interviews.evidenceId] }),
  metrics: many(evidenceMetrics),
  readings: many(readingEvidence),
}));
export const peopleRelations = relations(people, ({ many }) => ({
  interviews: many(interviews),
}));
export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  person: one(people, { fields: [interviews.personId], references: [people.id] }),
  evidence: one(evidence, { fields: [interviews.evidenceId], references: [evidence.id] }),
  script: one(scripts, { fields: [interviews.scriptId], references: [scripts.id] }),
  answers: many(answers),
}));
export const scriptsRelations = relations(scripts, ({ many }) => ({
  questions: many(scriptQuestions),
  interviews: many(interviews),
}));
export const scriptQuestionsRelations = relations(scriptQuestions, ({ one }) => ({
  script: one(scripts, { fields: [scriptQuestions.scriptId], references: [scripts.id] }),
  question: one(questions, { fields: [scriptQuestions.questionId], references: [questions.id] }),
}));
export const questionsRelations = relations(questions, ({ many }) => ({
  scriptQuestions: many(scriptQuestions),
  answers: many(answers),
}));
export const answersRelations = relations(answers, ({ one }) => ({
  interview: one(interviews, { fields: [answers.interviewId], references: [interviews.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));
export const stageChangesRelations = relations(stageChanges, ({ one }) => ({
  experiment: one(experiments, { fields: [stageChanges.experimentId], references: [experiments.id] }),
}));
export const commentsRelations = relations(comments, ({ one }) => ({
  experiment: one(experiments, { fields: [comments.experimentId], references: [experiments.id] }),
}));
