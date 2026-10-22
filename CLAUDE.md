# Hunchcycle: working notes for Claude

Read `BRIEF.md` first. It is the spec and the source of truth for v1. `DECISIONS.md` records choices made during the build that the brief didn't cover. Add to it when you make a new one.

## Who this is for

Adam Waitt (founder of Play Action) is building this to replace the Google Doc and spreadsheet his lean startup coach uses to run their coaching. v1 is single-team (Play Action) with two roles, owner and coach. Adam is not a developer; explain what you did in plain language and keep him in the loop at each milestone.

## Status

- Milestone 1 is done: Drizzle schema (`src/db/schema.ts`), migrations (`drizzle/`), seed import (`scripts/seed.ts`), read-only list pages for experiments, assumptions, runs, people, interviews, scripts, and questions.
- Milestone 2 is built, waiting for Adam to check it (2026-10-22): the board is the home page (`src/app/page.tsx`, `src/components/board/`), one row per experiment that expands left to right across six columns (Assumption, Hypothesis, Test (MVP), Running, Results, Decision). Rows are named by type and cycle number ("Customer Interviews 2"); finished experiments are listed separately underneath as slim lines. In the UI, experiments are called Sprints and runs are called Sessions (code and tables keep the BRIEF names). Drag and drop with dnd-kit, card drawer with progressive sections, "Create next experiment" on closed rows, stage gates (`src/lib/gates.ts`, enforced again in `src/app/actions.ts`), split from Hypothesis, WIP warning over 3 in Running, stale flag with stale cards sorted first, closed cards listed under the board and searchable.
- Next after Adam signs off: Milestone 3 (BRIEF section 12).
- Stop after each milestone, summarize what was built, and wait for Adam to check it before starting the next.

## Open items to confirm with Adam

- Did the Sprint 2 Google Ads test produce results? It's seeded as Running, past its report date. Adam is checking (asked 2026-10-22).
- All seeded assumptions and experiments carry the tag "seeded, review me". Importance and evidence scores were estimated.

## Running locally

- Needs a Postgres database. Simplest on Adam's machine: use the Supabase project directly. Put its connection strings in `.env` (see `.env.example`): For now both point at the session pooler (port 5432); see Infrastructure below. Never commit `.env`.
- `npm install`, `npm run db:migrate`, `npm run seed`, `npm run dev`.
- Keep the project at a short path such as `C:\Users\adamw\hunchcycle`. A long folder path breaks `npm install` on Windows (esbuild's binary goes past the 260 character limit).
- Seed files are NOT in the repo (real names and emails). They go in `seed/private/interviews.xlsx` and `seed/private/coaching-doc.docx`, which is gitignored. Adam has the originals ("Customer Interview Script (Responses).xlsx" and "Coaching - Adam Waitt.docx"). `npm run seed` wipes the database before loading.

## Infrastructure

- GitHub: `PostModernPost/hunchcycle` (private), branch `main`.
- Supabase: project ref `iumefduhzfimwiytqdcp` in the Hunchcycle org. Migrated and seeded 2026-10-22. The direct host (`db.<ref>.supabase.co`) is IPv6 only and doesn't work on Adam's network. Locally both `DATABASE_URL` and `DIRECT_URL` use the session pooler (`aws-0-us-east-1.pooler.supabase.com:5432`, user `postgres.<ref>`), because the transaction pooler (6543) hangs under concurrent queries from postgres-js (see DECISIONS.md). Must be resolved before the Vercel deploy.
- Vercel: team "Adam Waitt's projects" (`team_Rg04dlv2tXWKdPDKgOFeU77S`). No project created yet. Deploy only when Adam says to (milestone 6). Env vars needed: `DATABASE_URL`, `DIRECT_URL`, `OWNER_PASSWORD`, `COACH_PASSWORD`, `SESSION_SECRET`.
- Domains: hunchcycle.com and hunchcycle.app, bought on Squarespace. DNS will need to point at Vercel at deploy time.

## Conventions

- Stack: Next.js 15 App Router, TypeScript, Tailwind v4, Drizzle ORM with postgres-js. Prisma was dropped (see DECISIONS.md).
- Server components query the database directly through `src/db`. Pages that read data use `export const dynamic = "force-dynamic"`.
- Keep the v1 scope cap in BRIEF section 11. If something outside it seems necessary for the core loop, ask Adam first.
- User-facing copy: plain, direct words. No em dashes or en dashes anywhere in UI text or docs written for Adam; use commas, periods, or parentheses.
