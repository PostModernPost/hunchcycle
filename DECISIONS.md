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
