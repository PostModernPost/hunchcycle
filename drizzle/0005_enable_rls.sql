-- Lock Supabase's public data API (PostgREST) out of every table. Supabase exposes the public schema over
-- HTTP to anyone with the project URL and anon key; with row level security on and no policies, that route
-- returns nothing. The app connects as the table owner (postgres), which row level security doesn't apply to.
-- Any new table needs the same line (see CLAUDE.md).
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assumption_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assumptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evidence_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "experiment_assumptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "experiment_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "experiment_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "experiments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "metric_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "open_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reading_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "script_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stage_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weekly_briefs" ENABLE ROW LEVEL SECURITY;
