# Build Brief: Hunchcycle

Read this whole file before writing code. It is the source of truth for v1. If something here conflicts with your instincts about what a SaaS should have, follow this file. If something is ambiguous, pick the simplest option and note the choice in `DECISIONS.md`.

## 1. What this is and why

A web app that runs a lean startup coaching engagement in one place. It replaces a sprawling Google Doc plus a 28-column interview spreadsheet that a founder (Adam, Play Action) and his lean startup coach currently use.

The core idea is an evidence trail: every decision traces back through experiments to the assumptions they tested and the raw evidence (interviews, metric readings) behind them.

v1 has exactly one team (Play Action) and two roles: the owner (Adam) and the coach. It is itself a lean experiment. The test is whether, within three coaching sessions, the coach opens the weekly brief in this app instead of the Google Doc, or comments in it. Build only what that test needs.

## 2. Core model

The chain the whole product follows:

Assumption → Experiment (hypothesis + metrics) → Run → Evidence → Results → Decision → updated Assumption → next Experiment

Relationships (all many-to-many unless noted):

- An Experiment tests one or more Assumptions. An Assumption can be tested by many Experiments over time.
- An Experiment uses one or more Runs. A Run can serve several Experiments (example: one in-person group workout night serves a completion experiment, a social experiment, and a referral experiment).
- Evidence belongs to exactly one Run (one-to-many). Each piece of evidence can be tagged to one or more Experiment metrics.
- An Interview is a type of Evidence. It belongs to one Person and uses one Script version.
- A Script is an ordered list of Questions drawn from a shared Question Bank. Scripts are versioned by copying.

## 3. Data model

Use Prisma with PostgreSQL. Fields below are the minimum; add ids, timestamps, and foreign keys as needed.

**Assumption**
- statement (text)
- category: customer | problem | solution | channel | revenue | other
- importance 1 to 5 (how much the business depends on it)
- evidence 1 to 5 (how much proof exists)
- willingness_to_change 1 to 10 (the coach's field)
- status: untested | testing | supported | refuted | retired
- history: a log of every change to evidence/status, each entry linked to the Experiment decision that caused it
- parent_assumption (optional, for assumptions spawned from results)

**Experiment** (the card on the board)
- title
- stage: assumption | hypothesis | experiment | metrics | running | results | decision | closed
- linked assumptions (many)
- hypothesis fields: who, action, how_many, by_when, because (the "because" displays the linked assumption statements; free-text addition allowed)
- method (interviews, survey, pilot, landing page, event, concierge, other), channel, sample_size_target, start_date, report_date
- script (optional, required if method is interviews or survey)
- metrics (one-to-many, see below)
- raw_learnings (text, entered first), insights (text, entered after)
- decision: persevere | pivot | kill, plus decision_note
- sibling_group (optional id shared by cards split from the same parent)
- comments (from owner or coach)

**Metric** (belongs to one Experiment)
- name
- type: rate (numerator / denominator) | count | score
- source (free text but required, example "PostHog: session_completed", "Stripe payment link", "Interview field: 1 to 10 score")
- pass_line + pass_decision (what we do if it passes)
- kill_line + kill_decision (what we do if it fails)
- readings: list of {value, numerator, denominator, date, linked evidence ids, verified boolean}
- result: pass | fail | unclear (set in results stage)

**Run**
- name, date (or start/end for multi-day runs like an NFL week), location, run_by (people names), notes, recording links
- linked experiments (many)
- interference_checked boolean + note (see section 5)

**Evidence**
- run (one)
- type: interview | observation | metric_reading | survey_response | other
- summary text, attachments/links
- tags to metrics (many)

**Person** (fixed fields, stored once)
- name, gender, age, location, contact, channel_found (how we found them), platform, fantasy (text), bettor (text), notes
- segment tags (many, free tags like "lapsed home exerciser")
- A person can have many interviews.

**Interview** (extends Evidence)
- person, date, interviewers, recording device, script (version)
- the fields every interview has regardless of script: problem, persona, surprise, best_quote, question_that_got_quote, observation, insights, cold_hot (cold | warm | hot plus note), next_action, stage, score_1_to_10, score_source: asked | guessed
- answers: one per script question {question, answer_text, asked: yes | no | not_recorded}
- transcript_text (paste area), summary_text (paste area)

**Question** (the bank)
- canonical text, tags, created date
- A question keeps its identity across scripts even if wording changes slightly.

**Script**
- name, version label, parent script (the one it was copied from)
- ordered questions, each with an optional wording override for that script

**WeeklyBrief**
- date, generated content snapshot, coach comments

## 4. Board

Columns, left to right, match the chain. A card can move forward only when the current column's required inputs are filled. When a card moves into a column, that column's input section appears on the card (progressive disclosure). Earlier sections stay visible but collapsed.

| Column | Inputs that appear here | Required to move on |
|---|---|---|
| Assumption | Pick or create linked assumptions | At least one linked assumption |
| Hypothesis | who, action, how_many, by_when, because | All five filled |
| Experiment | method, channel, sample size, dates, script | Method, start and report dates; script if interviews or survey |
| Metrics | One or more metrics | Every metric has source, pass line, pass decision, kill line, kill decision |
| Running | Link runs, add evidence, record readings | At least one run linked |
| Results | Result per metric, raw learnings, then insights | Every metric has a result; raw learnings filled |
| Decision | persevere / pivot / kill, note, new evidence/status for each linked assumption | Decision chosen and every linked assumption updated |

Board rules:
- **Split:** from the Hypothesis column a card can be split into sibling cards that share the same assumptions (for parallel tests of one assumption).
- **WIP limit:** show a warning when more than 3 cards are in Running. Do not block.
- **Stale flag:** a card in Running past its report date shows a visible flag and sorts to the top of the column.
- **Loop back:** completing Decision closes the card, writes the change to each linked assumption's history, and offers "Create next experiment," which opens a new card in the Assumption column prefilled with the same assumptions plus any new assumptions created in Results. Closed cards leave the board but stay searchable and visible from each assumption's history.
- Moving a card backward is allowed (to fix something) and does not erase data.

## 5. Metric and evidence rules (actionable, accessible, auditable)

- No metric without decisions. The pass and kill decision text fields are required, not optional.
- Rates are the default type. Choosing `count` shows an inline warning: "Counts only go up. What would you do differently at 2 vs 12?" Allow it anyway.
- Every reading can be clicked to show the evidence and people behind it. A reading with no linked evidence is shown as unverified.
- Interview scores have `score_source`. Guessed scores (example: AI-assigned) display with an "unverified" marker and are excluded from averages by default, with a toggle to include them.
- **Interference check:** when a Run is linked to 2 or more experiments, the Run shows a prompt "Could these experiments affect each other's results?" with a checkbox and note field. Example given in the UI help text: asking for payment at the same event where you measure enjoyment.

## 6. Views

1. **Board** (default screen). Section 4.
2. **Assumption map.** 2x2 scatter of importance (y) vs evidence (x). Top-left (important, little evidence) is labeled "Test next." Clicking an assumption opens it with its history and every experiment that tested it. List view toggle.
3. **Runs.** Chronological list (calendar optional, skip if it costs more than a few hours). Each run shows linked experiments and its evidence.
4. **People and interviews.** People list with segment tags and interview count. Interview entry form: pick person (or create), pick script, fixed fields, then one answer box per script question with an "asked / not asked" toggle. Paste areas for transcript and summary.
5. **Scripts and question bank.** Create a script, "copy to new version," add questions from the bank or new ones, reorder. Question detail page shows every answer to that question across all interviews and scripts, filterable by script version and segment.
6. **Weekly brief.** Generated on demand for a date range (default: since last brief). Sections: cards that moved columns, decisions made, assumptions whose evidence/status changed, metric readings added, stale cards, what is due next week (report dates), and open questions (a simple list the owner adds to). Save as a snapshot. Coach can comment on the brief and on any card.

## 7. Transcripts

No AI in v1. Adam uses Plaud separately and pastes the transcript and/or summary into the interview's paste areas, then fills fields by hand. Add a disabled button on the interview form labeled "Fill from transcript (coming later)" and keep the answer-mapping logic in one module so it can be swapped for an AI call later.

## 8. Access

No user accounts in v1. Two passwords set by environment variable: `OWNER_PASSWORD` (full edit) and `COACH_PASSWORD` (read everything, comment anywhere, cannot edit or move cards). Login sets a signed cookie with the role. Comments record which role wrote them, plus a name field. Everything is behind the login, including the brief.

## 9. Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL. Local development uses a local Postgres. Production uses Supabase Postgres (connection strings via env vars `DATABASE_URL` and `DIRECT_URL`).
- Drag and drop: dnd-kit
- Charts (assumption map only): plain SVG or a small library
- Deploy target: Vercel. Do not deploy until told to.
- Keep dependencies minimal. No component library unless it saves real time.

## 10. Seed import

Write a one-time import script `npm run seed` that reads from `seed/private/` (gitignored, contains real people's names and emails; never commit it).

From `seed/private/interviews.xlsx`:
- **Tab "All":** about 20 interviews from 2026-09-10 to 2026-10-19. Columns map to Person fields (name, gender, age, location, channel, platform, contact, fantasy?, bettor?, where to find others like you) and Interview fixed fields (date, who did the interview, problem, persona, surprise, direct quote, question that got the quote, comments, observation, insights, current stage, cold/hot, next action, sale, method, solution, "will this person use PAL as it is now 1-10"). The 1 to 10 scores in this tab were AI-guessed: import with `score_source = guessed`.
- Known data fixes: Oscar's row dated 2023-09-07 should be 2026-09-10. There are two different Oscars (Oscar S., sales, 7 fantasy leagues; Oscar W., security); create two Person records. Rows with only a name and nothing else (example: Britany) import as Person only.
- Create a Script "Bar interviews v1" from the 11 questions listed in the coaching doc's "1b results" section (sports followed, last game at home, phone during game, commercial breaks, restless/bored, job activity, exercise frequency, media while working out, apps/wearables, tried to be active around sports, weirdest thing to get fit). Interviews from "All" attach to this script; answers are left as not_recorded because the sheet stores summaries, not per-question answers.
- **Tab "Form Responses 1":** about 12 survey responses from August 2026. Create Script "Survey v1" from the form's column headers and import each response as Person + Interview (type survey_response) with real per-question answers. Map survey questions that match the bar script's questions to the same bank Question (example: commercial breaks, exercise frequency, apps) so they are comparable.
- **Tabs "CONSOLIDATED learning" and "Solution sprint one":** mostly empty. Import any non-empty text as notes on the relevant experiment, skip otherwise.

From `seed/private/coaching-doc.docx` (convert with pandoc or mammoth), create these records. Mark every seeded assumption and experiment with a "seeded, review me" tag so Adam can correct them.

Assumptions:
1. A sports fan watching at home, prompted by live game moments, will do the exercises and come back for another game without being nudged. (solution, importance 5, evidence 2)
2. Fans who already own a little home equipment and watch at home are the best early segment. (customer, importance 4, evidence 3)
3. The bar is a good place to find fans but a poor place for them to use the product. (channel, importance 3, evidence 4)
4. Friends and points/stakes drive repeat use more than solo use. (solution, importance 4, evidence 2)
5. Active users will pay $5 for a season pass. (revenue, importance 4, evidence 1)
6. People doing prescribed PT exercises want a trigger to actually do them. (problem, importance 3, evidence 2)

Experiments and runs:
- "Bar customer discovery interviews" (closed, decision pivot toward home viewers). Runs: one per interview date at 33 Taps / The Woodman (9/10, 9/12, 9/15, 9/25). Links assumptions 2 and 3. Raw learnings and insights come from the doc's "Customer Discovery: 17 Interviews + Next Test" section.
- "August survey" (closed). One run, August 2026. Links assumption 2. Insight: respondents likely came through Adam's network and knew the concept, so biased on demand but good recruit list.
- "Game Day Pilot" (stage running). Links assumptions 1, 4, 5. Four metrics from the doc's H1 to H4 table, with their pass and kill lines and the "What each result means" text as decisions. Runs: NFL Weeks 5 through 8.
- "PT clinic side test" (stage hypothesis). Links assumption 6. Pass line from the doc: at least 1 clinic agrees to hand it out and at least 3 patients sign up within 3 weeks.
- "In-person group exercise test v2" (stage assumption). Links assumptions 1 and 4. Note from coach comment 2026-10-21: separate top-of-funnel experiments from the actual test, get 10 to 15 more rows in the database first.
- The two 2026-10-19 interviews run by Patrick Botkins go in a run "10/19 interviews (Patrick)" linked to the in-person group test.

Question bank: also add the coach's recommended questions: "Is there any exercise you're supposed to be doing and aren't?", "Have you ever exercised in the room where you watch, even once?", and "1 to 10, how likely are you to use this?" (asked out loud).

## 11. Out of scope for v1

Do not build: billing, multiple teams or workspaces, user accounts/signup, templates for other coaches, AI features, Slack/WhatsApp/email integrations, notifications, PostHog or Stripe API integrations (metric readings are entered by hand), mobile app, public sharing, theming, dark mode, onboarding flows, analytics dashboards beyond the assumption map. If you think something outside this list is necessary for the core loop, stop and ask.

## 12. Build order

Stop after each milestone, summarize what was built, and wait for Adam to check it.

1. Project scaffold, Prisma schema, local Postgres, seed import. Simple read-only list pages to confirm the seed data looks right.
2. Board with all columns, drag and drop, card drawer with progressive sections, gates, split, WIP warning, stale flag.
3. Runs, evidence, people, interview form, scripts with versioning, question bank with cross-interview answer view.
4. Assumption map, assumption history, decision loop back and "Create next experiment."
5. Weekly brief, comments, owner/coach password login.
6. Deploy to Vercel with Supabase (only when told).

## 13. Done means

- Every seeded record is visible and editable, and nothing from the spreadsheet or doc listed in section 10 is missing.
- A new card can go from Assumption to Decision, and the gates block it at each step until the required inputs exist.
- Closing the Game Day Pilot card updates assumptions 1, 4, 5 and offers a prefilled next experiment.
- Changing the bar script into a v2 (drop 2 questions, add 2) leaves all old interviews intact, and the question detail page shows answers across both versions.
- The coach login can read everything and comment, and cannot edit.
- The weekly brief for the last 7 days lists real changes.
