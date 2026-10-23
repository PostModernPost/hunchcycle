CREATE TABLE "stage_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"from_stage" "stage" NOT NULL,
	"to_stage" "stage" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;