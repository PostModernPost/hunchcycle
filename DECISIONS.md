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

