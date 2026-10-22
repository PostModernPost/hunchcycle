CREATE TYPE "public"."asked" AS ENUM('yes', 'no', 'not_recorded');--> statement-breakpoint
CREATE TYPE "public"."assumption_category" AS ENUM('customer', 'problem', 'solution', 'channel', 'revenue', 'other');--> statement-breakpoint
CREATE TYPE "public"."assumption_status" AS ENUM('untested', 'testing', 'supported', 'refuted', 'retired');--> statement-breakpoint
CREATE TYPE "public"."cold_hot" AS ENUM('cold', 'warm', 'hot');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('persevere', 'pivot', 'kill');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('interview', 'observation', 'metric_reading', 'survey_response', 'other');--> statement-breakpoint
CREATE TYPE "public"."method" AS ENUM('interviews', 'survey', 'pilot', 'landing_page', 'event', 'concierge', 'other');--> statement-breakpoint
CREATE TYPE "public"."metric_result" AS ENUM('pass', 'fail', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('rate', 'count', 'score');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'coach');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('asked', 'guessed');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('assumption', 'hypothesis', 'experiment', 'metrics', 'running', 'results', 'decision', 'closed');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" text PRIMARY KEY NOT NULL,
	"interview_id" text NOT NULL,
	"question_id" text NOT NULL,
	"text" text,
	"asked" "asked" DEFAULT 'not_recorded' NOT NULL,
	CONSTRAINT "answers_interview_id_question_id_unique" UNIQUE("interview_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "assumption_history" (
	"id" text PRIMARY KEY NOT NULL,
	"assumption_id" text NOT NULL,
	"experiment_id" text,
	"from_evidence" integer,
	"to_evidence" integer,
	"from_status" "assumption_status",
	"to_status" "assumption_status",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assumptions" (
	"id" text PRIMARY KEY NOT NULL,
	"statement" text NOT NULL,
	"category" "assumption_category" DEFAULT 'other' NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"evidence" integer DEFAULT 1 NOT NULL,
	"willingness_to_change" integer,
	"status" "assumption_status" DEFAULT 'untested' NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text,
	"brief_id" text,
	"role" "role" NOT NULL,
	"author_name" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"type" "evidence_type" DEFAULT 'observation' NOT NULL,
	"summary" text,
	"links" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_metrics" (
	"evidence_id" text NOT NULL,
	"metric_id" text NOT NULL,
	CONSTRAINT "evidence_metrics_evidence_id_metric_id_pk" PRIMARY KEY("evidence_id","metric_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_assumptions" (
	"experiment_id" text NOT NULL,
	"assumption_id" text NOT NULL,
	CONSTRAINT "experiment_assumptions_experiment_id_assumption_id_pk" PRIMARY KEY("experiment_id","assumption_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_runs" (
	"experiment_id" text NOT NULL,
	"run_id" text NOT NULL,
	CONSTRAINT "experiment_runs_experiment_id_run_id_pk" PRIMARY KEY("experiment_id","run_id")
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"stage" "stage" DEFAULT 'assumption' NOT NULL,
	"who" text,
	"action" text,
	"how_many" text,
	"by_when" text,
	"because_note" text,
	"method" "method",
	"channel" text,
	"sample_size_target" integer,
	"start_date" timestamp with time zone,
	"report_date" timestamp with time zone,
	"script_id" text,
	"raw_learnings" text,
	"insights" text,
	"decision" "decision",
	"decision_note" text,
	"closed_at" timestamp with time zone,
	"sibling_group" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_id" text NOT NULL,
	"person_id" text NOT NULL,
	"date" timestamp with time zone,
	"interviewers" text,
	"recording_device" text,
	"script_id" text,
	"problem" text,
	"persona" text,
	"surprise" text,
	"best_quote" text,
	"question_that_got_quote" text,
	"comments" text,
	"observation" text,
	"insights" text,
	"stage" text,
	"cold_hot" "cold_hot",
	"cold_hot_note" text,
	"next_action" text,
	"sale" text,
	"method" text,
	"solution" text,
	"score" integer,
	"score_source" "score_source",
	"score_note" text,
	"transcript_text" text,
	"summary_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_evidence_id_unique" UNIQUE("evidence_id")
);
--> statement-breakpoint
CREATE TABLE "metric_readings" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"value" double precision,
	"numerator" integer,
	"denominator" integer,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"type" "metric_type" DEFAULT 'rate' NOT NULL,
	"source" text,
	"pass_line" text,
	"pass_decision" text,
	"kill_line" text,
	"kill_decision" text,
	"result" "metric_result"
);
--> statement-breakpoint
CREATE TABLE "open_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"age" integer,
	"location" text,
	"contact" text,
	"channel_found" text,
	"platform" text,
	"fantasy" text,
	"bettor" text,
	"where_to_find_others" text,
	"notes" text,
	"segments" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_evidence" (
	"reading_id" text NOT NULL,
	"evidence_id" text NOT NULL,
	CONSTRAINT "reading_evidence_reading_id_evidence_id_pk" PRIMARY KEY("reading_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"location" text,
	"run_by" text,
	"notes" text,
	"recording_links" text[] DEFAULT '{}'::text[] NOT NULL,
	"interference_checked" boolean DEFAULT false NOT NULL,
	"interference_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"script_id" text NOT NULL,
	"question_id" text NOT NULL,
	"order" integer NOT NULL,
	"wording_override" text,
	CONSTRAINT "script_questions_script_id_question_id_unique" UNIQUE("script_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version_label" text DEFAULT 'v1' NOT NULL,
	"parent_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"range_start" timestamp with time zone NOT NULL,
	"range_end" timestamp with time zone NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_history" ADD CONSTRAINT "assumption_history_assumption_id_assumptions_id_fk" FOREIGN KEY ("assumption_id") REFERENCES "public"."assumptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_history" ADD CONSTRAINT "assumption_history_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_brief_id_weekly_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."weekly_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_metrics" ADD CONSTRAINT "evidence_metrics_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_metrics" ADD CONSTRAINT "evidence_metrics_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assumptions" ADD CONSTRAINT "experiment_assumptions_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assumptions" ADD CONSTRAINT "experiment_assumptions_assumption_id_assumptions_id_fk" FOREIGN KEY ("assumption_id") REFERENCES "public"."assumptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_readings" ADD CONSTRAINT "metric_readings_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_evidence" ADD CONSTRAINT "reading_evidence_reading_id_metric_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."metric_readings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_evidence" ADD CONSTRAINT "reading_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_questions" ADD CONSTRAINT "script_questions_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_questions" ADD CONSTRAINT "script_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;