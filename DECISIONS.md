# Decisions

Choices made during the build that the brief didn't spell out.

## Milestone 1

- **Drizzle instead of Prisma.** Prisma downloads engine binaries from binaries.prisma.sh, which the build workspace can't reach. Drizzle is pure JavaScript and works the same with Supabase. Schema lives in `src/db/schema.ts`, migrations in `drizzle/`.
- **More seeded experiments than the brief listed.** The coaching doc also contains Sprint 1 (email sign-up from the warm list), Sprint 2 (Google Ads sign-up, no results recorded), and the F45 Broncos activation with its Eventbrite funnel. All are seeded. The F45 event is "In-person group exercise test v1" and the Groundfloor plan is v2.
- **Extra seeded assumptions** came from those experiments: network email sign-ups (refuted), Eventbrite/social filling an event (refuted), face-to-face invites (untested), prompts carrying through dead time (refuted), prompt timing not interfering (untested), paid search (testing), presets (from the doc's assumption backlog).
- **Britany is an interview, not a person-only record.** Her row has a short observation (bartender at The Woodman).
- **Bar script has 13 questions, not 11.** Two of the doc's questions were really two questions each ("which sports / how often", "how many times / what did you do"). Splitting them lets the survey's separate columns map to the same bank questions.
- **Plaud write-ups from the coaching doc** are attached to each interview as `summaryText`. Bradley and Darby share one write-up.
- **"Platform" column is the recording device** (it holds "DJI Mic 3"), so it maps to `interview.recordingDevice`.
- **Survey respondents are named by email prefix** since the form didn't collect names.
- **Game Day Pilot is seeded as Running** per the brief, but the doc doesn't show whether it launched. It's tagged for review.
- **No fonts from Google.** System font stack, so builds don't depend on fetching fonts.

## After Milestone 1 (2026-10-22, answers from Adam)

- **Game Day Pilot did not launch as a home pilot.** Adam ran in-person group events instead (F45 Broncos on Oct 15, Groundfloor on Oct 29). The pilot is now seeded in the Experiment column, and the four placeholder NFL week runs were removed because they never happened. Seed now reports 9 runs instead of 13.
- **Groundfloor v2 has a start date of Oct 29**, the day of the coworking space class.

## Milestone 2

- **The board is the home page.** `/experiments` redirects to it. The milestone 1 count tiles are gone; open questions come back with the weekly brief in milestone 5.
- **"Because" counts as filled once an assumption is linked**, since it displays the linked assumption statements. The free-text addition is optional.
- **Seeded "(not set)" placeholders count as empty** for the gates and show as blank required fields, so seeded cards show honestly what is missing.
- **Decision gate:** each linked assumption needs a history entry written by this experiment (new evidence score, status, note) before the card can close. Closing sets `closedAt`. "Create next experiment" is left for milestone 4.
- **Running section** links or creates runs, adds evidence to a linked run, and records readings. A reading linked to evidence is verified; one without is shown as unverified. The interference check is left for milestone 3 with the runs page.
- **Split** copies assumptions and hypothesis fields into a new card titled "(variant)", sharing a `siblingGroup`. Only allowed in Hypothesis.
- **Open card lives in the URL** (`/?card=<id>`), so a link or reload reopens it.
- **Session pooler for the app connection (local).** postgres-js against Supabase's transaction pooler (port 6543) hangs forever when several queries run at once (reproduced with 15 parallel board loads, even with `max: 1`, `fetch_types: false`, and without `?pgbouncer=true`). The session pooler handled the same load in about a second. Revisit before deploying to Vercel, where the transaction pooler is the usual choice for serverless.

## Milestone 2 revision (2026-10-22, Adam's feedback)

- **Rows instead of moving cards.** Each experiment is one row; it fills in left to right as it reaches each column, showing a short summary of every finished step. Drag the current step into a later column to expand the row (same gates as before), or into an earlier column to move it back. Clicking a step opens the drawer with that section open.
- **"Create next experiment" pulled forward from milestone 4.** A closed experiment (row or drawer) can start a new one in Assumption, titled "(next)", with the same assumptions linked. Adding assumptions spawned in Results is still milestone 4.
- **One fixed dark palette, no theme switch.** Adam asked for a soft dark look; BRIEF section 11 rules out theming and dark mode as features, so there is no toggle. Each column has its own hue. Tailwind's color scales are remapped in `globals.css` (low shades dark, high shades light) so existing pill classes read correctly on dark. `@theme static` keeps every color variable in the CSS, since the stage colors are only used from inline styles.

## Milestone 2, second revision (2026-10-22, Adam's choices)

- **Six columns.** The Experiment and Metrics columns are merged into **Test (MVP)**: method, channel, dates, script, and metrics are all designed there, and its gate needs both the old Experiment inputs and complete metrics. The `metrics` value stays in the database enum but is unused; `flowStage()` treats any card found there as being in `experiment` (the one seeded card there was moved). The enum value `experiment` keeps its name; only the label changed.
- **Rows stay "experiments"** because that is the word Adam's coach already uses.
- **"Run" is called "Session" in the app.** The table and code keep the name `runs`; the page moved to `/sessions` and `/runs` redirects there.
- **Group by assumption** is a switch on the board (`?view=assumptions`), on trial; Adam may revert it. One band per assumption, riskiest first (importance high, evidence low). Each experiment appears once, under its riskiest linked assumption, with "Also tests" links to the others. Rows in a band are in the order they were started, so repeated cycles read top to bottom. "Show closed" puts closed experiments inline in their bands. Assumptions with no experiment are listed at the bottom, each with "+ New experiment", which creates an experiment already linked to it.
- **Seeded placeholders** starting with "(not set" (including "(not set in doc) ...") count as empty.

## Experiment types (2026-10-22, Adam's choices)

- **Rows are named by type and cycle number**, e.g. "Customer Interviews 2". Types live in `experiment_types` (starter list in `drizzle/0001_experiment_types.sql`; Adam can add more from any type dropdown). Each type has a `needsScript` flag that replaces the old interviews/survey script rule.
- **The type replaces the Method dropdown** in the UI. It can be changed any time (panel header or Test (MVP)); changing it gives the experiment the next number in the new type. The old `method` column is kept for history but not shown.
- **One subtitle field.** `experiments.title` is now the optional subtitle, which is also the MVP name in Test (MVP). Seeded titles became subtitles.
- **Numbering** counts up within a type in creation order. "Start next cycle" (was "Create next experiment") and Split both take the next number in the same type.
- **Seeded mapping** (Adam unsure, reversible since types are editable): bar interviews to Customer Interviews 1, August survey to Survey 1, Sprints 1 and 2 to Marketing 1 and 2, F45 and Groundfloor to Event 1 and 2, Game Day Pilot to Pilot 1, PT clinic to Partnership 1. Adam's own new bar interviews row became Customer Interviews 2.

## Simplification pass (2026-10-22, Adam picked A, B, C, E, F)

- **Group by assumption is removed.** Rows are grouped by type instead, cycles in number order, so a type's history reads 1, 2, 3. Groups with something past its report date come first, then groups with active cycles, then finished-only groups.
- **Finished cycles are slim lines** (date, decision, note) inside their type group. The newest finished cycle of a type offers "Start next cycle". "Hide finished cycles" toggles them.
- **Finished steps show one short fact** ("2 assumptions", the MVP name, "3 sessions", "2 pass, 1 fail", "Pivot"). Only the current step shows detail and what is missing.
- **Seeded tag:** one notice on the board instead of a tag per row; the tag and a "Mark reviewed" button (clears it) are in the panel.
- **Panel:** new assumption, add session, add evidence, and record a reading open from "+" buttons. The checklist shows only what is missing and the main button; "Move back" is in a small menu.
- Not done (Adam passed on it): collapsing the toolbar into one "New experiment" button.
- **Reverted the type grouping (same day).** Adam didn't like active and finished cycles mixed together. Active experiments are rows again (past report date first, then furthest along); finished ones sit in a separate "Show finished experiments" section as slim lines, newest first, each with "Start next cycle". The other simplifications stay.

## Sprints (2026-10-22)

- **Experiments are called "sprints" everywhere in the UI**, at Adam's request (his coaching doc already says "Sprint 1", "Sprint 2"). Code, tables, and the BRIEF keep the word "experiment". Buttons read "Add sprint", "Start next sprint", "Close sprint"; the detail page moved to `/sprints/[id]` and `/experiments/[id]` redirects there.

