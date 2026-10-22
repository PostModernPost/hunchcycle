CREATE TABLE "experiment_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"needs_script" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "type_id" text;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "cycle_number" integer;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_type_id_experiment_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."experiment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Starter types (Adam can add more in the app).
INSERT INTO "experiment_types" ("id", "name", "needs_script") VALUES
	(gen_random_uuid()::text, 'Customer Interviews', true),
	(gen_random_uuid()::text, 'Survey', true),
	(gen_random_uuid()::text, 'Marketing', false),
	(gen_random_uuid()::text, 'Landing Page', false),
	(gen_random_uuid()::text, 'Feature', false),
	(gen_random_uuid()::text, 'Event', false),
	(gen_random_uuid()::text, 'Pilot', false),
	(gen_random_uuid()::text, 'Concierge', false),
	(gen_random_uuid()::text, 'Partnership', false),
	(gen_random_uuid()::text, 'Other', false)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- File existing experiments under a type, then number them by start order within each type.
UPDATE "experiments" e SET "type_id" = t."id"
FROM (VALUES
	('Bar customer discovery interviews', 'Customer Interviews'),
	('August survey', 'Survey'),
	('Sprint 1: email sign-up from warm list', 'Marketing'),
	('Sprint 2: Google Ads email sign-up', 'Marketing'),
	('Game Day Pilot', 'Pilot'),
	('In-person group exercise test v1 (F45 Broncos)', 'Event'),
	('In-person group exercise test v2 (Groundfloor)', 'Event'),
	('PT clinic side test', 'Partnership')
) AS m("title", "type") JOIN "experiment_types" t ON t."name" = m."type"
WHERE e."title" = m."title";--> statement-breakpoint
UPDATE "experiments" SET "type_id" = (SELECT "id" FROM "experiment_types" WHERE "name" = 'Other') WHERE "type_id" IS NULL;--> statement-breakpoint
UPDATE "experiments" e SET "cycle_number" = n."n"
FROM (SELECT "id", row_number() OVER (PARTITION BY "type_id" ORDER BY "created_at") AS "n" FROM "experiments") n
WHERE e."id" = n."id";
