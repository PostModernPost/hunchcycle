/**
 * One-time seed import. Reads seed/private/interviews.xlsx and seed/private/coaching-doc.docx
 * (both gitignored) and rebuilds the database contents from them.
 *
 * WARNING: wipes all existing rows first. Run only on an empty or throwaway database.
 *   npm run seed
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, schema as s } from "../src/db";

const SEED_DIR = path.join(process.cwd(), "seed", "private");
const REVIEW = "seeded, review me";

// ---------- helpers ----------

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim() || null;
    if ("text" in v) return String(v.text).trim() || null;
    if ("result" in v) return v.result == null ? null : String(v.result).trim() || null;
    return null;
  }
  const t = String(v).trim();
  return t === "" || t === "None" ? null : t;
}

function cellDate(v: ExcelJS.CellValue): Date | null {
  let date: Date | null = null;
  if (v instanceof Date) date = v;
  else {
    const t = cellText(v);
    if (!t) return null;
    date = new Date(t);
    if (isNaN(date.getTime())) return null;
  }
  // Date-only cells arrive as midnight UTC, which displays as the previous day in LA. Pin to local noon.
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) return d(date.toISOString().slice(0, 10));
  return date;
}

function parseColdHot(t: string | null) {
  if (!t) return { coldHot: null, note: null };
  const m = t.trim().match(/^(cold|warm|hot)\b/i);
  return {
    coldHot: m ? (m[1].toLowerCase() as "cold" | "warm" | "hot") : null,
    note: t.trim(),
  };
}

function parseScore(t: string | null) {
  if (!t) return { score: null, note: null };
  const m = t.trim().match(/^(\d+)/);
  return { score: m ? Number(m[1]) : null, note: t.trim() };
}

const d = (iso: string) => new Date(iso + "T12:00:00-07:00");

/** Return the text between the line starting with `start` and the next line starting with any of `ends`. */
function section(lines: string[], start: string, ends: string[], from = 0): { text: string; endIdx: number } {
  const i = lines.findIndex((l, idx) => idx >= from && l.trim().startsWith(start));
  if (i < 0) return { text: "", endIdx: from };
  let j = lines.length;
  for (let k = i + 1; k < lines.length; k++) {
    const t = lines[k].trim();
    if (ends.some((e) => t.startsWith(e))) {
      j = k;
      break;
    }
  }
  const text = lines
    .slice(i + 1, j)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, endIdx: j };
}

// ---------- main ----------

async function main() {
  console.log("Wiping existing data...");
  await db.execute(sql`TRUNCATE
    answers, script_questions, interviews, evidence_metrics, reading_evidence, evidence,
    experiment_runs, runs, metric_readings, metrics, assumption_history, experiment_assumptions,
    comments, weekly_briefs, open_questions, experiments, assumptions, scripts, questions, people
    CASCADE`);

  // ---- read sources ----
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(SEED_DIR, "interviews.xlsx"));
  const docText = (await mammoth.extractRawText({ path: path.join(SEED_DIR, "coaching-doc.docx") })).value;
  const L = docText.split("\n");

  // ---- question bank + scripts ----
  const Q = {
    leagues: "Which sports or leagues do you follow most?",
    frequency: "How often do you watch games during their seasons?",
    lastGame: "Walk me through the last game you watched at home. What room? Who were you with? What were you sitting on?",
    phone: "Where is your phone during a game? What are you usually doing?",
    breaks: "What do you usually do during commercial breaks or halftime?",
    bored: "When was the last time you felt restless or bored during a game? What did you do?",
    job: "How active or physically demanding is your job?",
    exerciseFreq: "How many times did you exercise per week in the last month?",
    exerciseKind: "What kind of exercise do you do?",
    media: "What media do you consume while working out?",
    apps: "What fitness apps, wearables, or routines do you use?",
    triedActive: "Have you ever tried to be more active specifically during or around sports watching?",
    weirdest: "What's the weirdest or most outside-the-box thing you've done to get fit or be healthy?",
    shouldBe: "Is there any exercise you're supposed to be doing and aren't?",
    room: "Have you ever exercised in the room where you watch, even once?",
    score: "1 to 10, how likely are you to use this? (asked out loud)",
  } as const;
  const qId: Record<keyof typeof Q, string> = {} as never;
  for (const [k, text] of Object.entries(Q)) {
    const [row] = await db
      .insert(s.questions)
      .values({ text, tags: k === "shouldBe" || k === "room" || k === "score" ? ["coach recommended"] : [] })
      .returning();
    qId[k as keyof typeof Q] = row.id;
  }

  const barOrder: (keyof typeof Q)[] = [
    "leagues", "frequency", "lastGame", "phone", "breaks", "bored", "job",
    "exerciseFreq", "exerciseKind", "media", "apps", "triedActive", "weirdest",
  ];
  const [barScript] = await db
    .insert(s.scripts)
    .values({ name: "Bar interviews", versionLabel: "v1", notes: "From the coaching doc's '1b results' question list. " + REVIEW })
    .returning();
  await db.insert(s.scriptQuestions).values(
    barOrder.map((k, i) => ({ scriptId: barScript.id, questionId: qId[k], order: i })),
  );

  // Survey columns 3..13 (1-indexed in exceljs) map to these bank questions
  const surveyCols: { col: number; q: keyof typeof Q; wording: string }[] = [];
  const form = wb.getWorksheet("Form Responses 1")!;
  const formHeader = form.getRow(1).values as ExcelJS.CellValue[];
  const surveyMap: (keyof typeof Q)[] = [
    "leagues", "frequency", "lastGame", "phone", "breaks", "job",
    "exerciseFreq", "exerciseKind", "media", "apps", "triedActive",
  ];
  surveyMap.forEach((q, i) => {
    const col = i + 3;
    surveyCols.push({ col, q, wording: cellText(formHeader[col]) ?? Q[q] });
  });
  const [surveyScript] = await db
    .insert(s.scripts)
    .values({ name: "Survey", versionLabel: "v1", notes: "August 2026 Google Form. Questions matched to the bar script where they ask the same thing." })
    .returning();
  await db.insert(s.scriptQuestions).values(
    surveyCols.map((c, i) => ({ scriptId: surveyScript.id, questionId: qId[c.q], order: i, wordingOverride: c.wording })),
  );

  // ---- assumptions ----
  const A = async (v: typeof s.assumptions.$inferInsert) =>
    (await db.insert(s.assumptions).values({ ...v, tags: [REVIEW] }).returning())[0];

  const a1 = await A({ statement: "A sports fan watching at home, prompted by live game moments, will do the exercises and come back for another game without being nudged.", category: "solution", importance: 5, evidence: 2, status: "testing" });
  const a2 = await A({ statement: "Fans who already own a little home equipment and watch at home are the best early segment.", category: "customer", importance: 4, evidence: 3, status: "testing" });
  const a3 = await A({ statement: "The bar is a good place to find fans but a poor place for them to use the product.", category: "channel", importance: 3, evidence: 4, status: "supported" });
  const a4 = await A({ statement: "Friends and points/stakes drive repeat use more than solo use.", category: "solution", importance: 4, evidence: 3, status: "testing" });
  const a5 = await A({ statement: "Active users will pay $5 for a season pass.", category: "revenue", importance: 4, evidence: 1, status: "untested" });
  const a6 = await A({ statement: "People doing prescribed PT exercises want a trigger to actually do them.", category: "problem", importance: 3, evidence: 2, status: "untested" });
  const a7 = await A({ statement: "People in our own network will sign up when we email them a link.", category: "channel", importance: 3, evidence: 4, status: "refuted" });
  const a8 = await A({ statement: "Eventbrite listings and social posts can fill an in-person session.", category: "channel", importance: 4, evidence: 4, status: "refuted" });
  const a9 = await A({ statement: "A face-to-face invite at a place people already spend their day gets them to show up.", category: "channel", importance: 4, evidence: 1, status: "untested" });
  const a10 = await A({ statement: "Game-triggered prompts alone keep people moving through a whole game, including dead time.", category: "solution", importance: 4, evidence: 3, status: "refuted" });
  const a11 = await A({ statement: "Prompt timing won't get in the way of actually watching and enjoying the game.", category: "solution", importance: 4, evidence: 1, status: "untested", notes: "Bradley raised this unprompted at F45." });
  const a12 = await A({ statement: "Paid search ads can drive casual fans to sign up.", category: "channel", importance: 3, evidence: 1, status: "testing" });
  await A({ statement: "Users want presets: pick a game, pick a workout.", category: "solution", importance: 2, evidence: 1, status: "untested", notes: "From the coaching doc's assumption backlog." });

  // ---- runs ----
  const R = async (v: typeof s.runs.$inferInsert) => (await db.insert(s.runs).values(v).returning())[0];

  // ---- people + interviews from tab "All" ----
  const all = wb.getWorksheet("All")!;
  type Row = ExcelJS.CellValue[];
  const rows: Row[] = [];
  all.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values as Row;
    if (cellText(v[4])) rows.push(v);
  });

  // doc summaries keyed by sheet name
  const titles: [string, string][] = [
    ["Kian Interview", "Kian"],
    ["Jasmine Interview", "Jasmine"],
    ["Oscar Interview 09 10", "Oscar S."],
    ["Chris Interview", "Chris"],
    ["Brayden Interview", "Braden"],
    ["Steve Interview", "Steve"],
    ["Ryan Interview", "Ryan"],
    ["Diego Interview", "Diego"],
    ["Miguel Interview", "Miguel"],
    ["Joshua Interview", "Joshua"],
    ["Matia Interview", "Matia"],
    ["Issac Interview", "Isaac"],
    ["James 9 24 Interview", "James Martinez"],
    ["Sabrina Interview", "Sabrina"],
    ["Oscar Interview", "Oscar W."],
    ["KJ Interview", "KJ"],
    ["Anthony Interview", "Anthony"],
  ];
  const titleStarts = titles.map((t) => t[0]);
  const summaries: Record<string, string> = {};
  let cursor = L.findIndex((l) => l.trim().startsWith("Kian Interview"));
  for (const [title, name] of titles) {
    const ends = [...titleStarts.filter((t) => t !== title && !(title === "Oscar Interview" && t.startsWith("Oscar"))), "adam@playaction.live"];
    // second Oscar title is a prefix of the first; search from cursor so we hit the right one
    const { text, endIdx } = section(L, title, ends, cursor);
    summaries[name] = text;
    cursor = endIdx;
  }
  const couple = section(L, "Notes from interview:", ["Clean Learnings"]).text;

  // segment tags from the 9/25 synthesis
  const segments: Record<string, string[]> = {
    "James Martinez": ["lapsed home exerciser"],
    Ryan: ["lapsed home exerciser"],
    KJ: ["lapsed home exerciser", "fantasy/stakes league"],
    Anthony: ["lapsed home exerciser", "fantasy/stakes league"],
    "Oscar S.": ["fantasy/stakes league", "rehab/PT compliance", "gym streamer"],
    "Oscar W.": ["fantasy/stakes league", "gym streamer"],
    Isaac: ["fantasy/stakes league"],
    Matia: ["rehab/PT compliance"],
    Kian: ["gym streamer"],
    Joshua: ["dropped: personal trainer"],
    Diego: ["dropped: personal trainer"],
    Miguel: ["dropped: social-ritual watcher"],
    Sabrina: ["dropped: social-ritual watcher"],
    "Bradley Benson": ["couple", "fantasy/stakes league"],
    "Darby Tingle": ["couple"],
  };

  // Build runs for bar interview nights, keyed by date
  const barRuns: Record<string, string> = {};
  const patrickRun = await R({
    name: "10/19 interviews (Patrick)",
    startDate: d("2026-10-19"),
    runBy: "Patrick Botkins",
    notes: "Follow-up interview with Bradley and Darby after the F45 Broncos activation.",
  });

  let oscarCount = 0;
  const personByName: Record<string, string> = {};
  for (const v of rows) {
    let name = cellText(v[4])!.trim();
    if (name === "Oscar") name = oscarCount++ === 0 ? "Oscar S." : "Oscar W.";

    let date = cellDate(v[2]);
    if (date && date.getUTCFullYear() === 2023) date = d("2026-09-10"); // known typo in sheet
    const ageT = cellText(v[6]);
    const [person] = await db
      .insert(s.people)
      .values({
        name,
        gender: cellText(v[5]),
        age: ageT ? Math.round(Number(ageT)) || null : null,
        location: cellText(v[7]),
        contact: cellText(v[10]),
        channelFound: cellText(v[8]),
        fantasy: cellText(v[25]),
        bettor: cellText(v[26]),
        whereToFindOthers: cellText(v[27]),
        segments: segments[name] ?? [],
        notes:
          name === "Oscar S." ? "Sales, 7 fantasy leagues. Sheet row was dated 2023-09-07; corrected to 2026-09-10."
          : name === "Oscar W." ? "Security worker. Second Oscar, split from Oscar S." : null,
      })
      .returning();
    personByName[name] = person.id;

    // A row with nothing beyond name/date/contact is a person only (e.g. Britany)
    const hasInterview = [11, 12, 13, 14, 17, 18, 20, 28].some((c) => cellText(v[c]));
    if (!hasInterview) continue;

    let runId: string;
    if (name === "Bradley Benson" || name === "Darby Tingle") {
      runId = patrickRun.id;
    } else {
      const key = date ? date.toISOString().slice(0, 10) : "unknown";
      if (!barRuns[key]) {
        const run = await R({
          name: `Bar interviews ${date ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}` : "(no date)"}`,
          startDate: date,
          location: cellText(v[7]),
          runBy: cellText(v[3]),
        });
        barRuns[key] = run.id;
      }
      runId = barRuns[key];
    }

    const ch = parseColdHot(cellText(v[20]));
    const sc = parseScore(cellText(v[28]));
    const summary =
      name === "Bradley Benson" || name === "Darby Tingle" ? couple : summaries[name] ?? null;

    const [ev] = await db
      .insert(s.evidence)
      .values({ runId, type: "interview", summary: cellText(v[18]) ?? cellText(v[11]) })
      .returning();
    const [iv] = await db
      .insert(s.interviews)
      .values({
        evidenceId: ev.id,
        personId: person.id,
        date,
        interviewers: cellText(v[3]),
        recordingDevice: cellText(v[9]),
        scriptId: name === "Bradley Benson" || name === "Darby Tingle" ? null : barScript.id,
        problem: cellText(v[11]),
        persona: cellText(v[12]),
        surprise: cellText(v[13]),
        bestQuote: cellText(v[14]),
        questionThatGotQuote: cellText(v[15]),
        comments: cellText(v[16]),
        observation: cellText(v[17]),
        insights: cellText(v[18]),
        stage: cellText(v[19]),
        coldHot: ch.coldHot,
        coldHotNote: ch.note,
        nextAction: cellText(v[21]),
        sale: cellText(v[22]),
        method: cellText(v[23]),
        solution: cellText(v[24]),
        score: sc.score,
        scoreSource: sc.score == null ? null : "guessed",
        scoreNote: sc.note,
        summaryText: summary || null,
      })
      .returning();

    if (iv.scriptId) {
      await db.insert(s.answers).values(
        barOrder.map((k) => ({ interviewId: iv.id, questionId: qId[k], asked: "not_recorded" as const })),
      );
    }
  }

  // ---- survey responses ----
  const surveyRun = await R({ name: "August survey (Google Form)", startDate: d("2026-08-10"), endDate: d("2026-08-11"), notes: "Respondents likely came through Adam's network." });
  const lateFormRun = await R({ name: "9/23 interview logged in the survey form", startDate: d("2026-09-23") });
  let surveyCount = 0;
  const formRows: Row[] = [];
  form.eachRow((row, n) => {
    if (n > 1 && cellText((row.values as Row)[2])) formRows.push(row.values as Row);
  });
  for (const v of formRows) {
    const email = cellText(v[2])!;
    const ts = cellDate(v[1]);
    const late = ts && ts > d("2026-09-01");
    const [person] = await db
      .insert(s.people)
      .values({ name: email.split("@")[0], contact: email, channelFound: late ? "Interview" : "August survey", segments: [] })
      .returning();
    const [ev] = await db
      .insert(s.evidence)
      .values({ runId: late ? lateFormRun.id : surveyRun.id, type: "survey_response" })
      .returning();
    const [iv] = await db
      .insert(s.interviews)
      .values({ evidenceId: ev.id, personId: person.id, date: ts, scriptId: surveyScript.id, method: "survey" })
      .returning();
    await db.insert(s.answers).values(
      surveyCols.map((c) => {
        const t = cellText(v[c.col]);
        const missing = !t || /not covered in interview/i.test(t);
        return { interviewId: iv.id, questionId: qId[c.q], text: missing ? null : t, asked: missing ? ("not_recorded" as const) : ("yes" as const) };
      }),
    );
    surveyCount++;
  }

  // ---- experiments ----
  const synthesis = section(L, "Play Action Customer Discovery: 17 Interviews", ["Kian Interview"]).text;
  const headline = section(L, "The headline", ["Who we talked to"]).text;
  const f45Observations = section(L, "Observations:", ["Eventbrite data:"]).text;
  const f45Clean = section(L, "Clean Learnings", ["NEW QUESTIONS"]).text;
  const newQuestions = section(L, "NEW QUESTIONS", ["Hypothesis"]).text
    .split("\n").map((l) => l.replace(/^[-•\s]+/, "").trim()).filter(Boolean);
  const gfBecause = L.find((l) => l.includes("At F45, both attendees completed every movement"))?.trim() ?? null;

  const X = async (v: typeof s.experiments.$inferInsert, assumptionIds: string[], runIds: string[] = []) => {
    const [e] = await db.insert(s.experiments).values({ ...v, tags: [REVIEW] }).returning();
    if (assumptionIds.length)
      await db.insert(s.experimentAssumptions).values(assumptionIds.map((assumptionId) => ({ experimentId: e.id, assumptionId })));
    if (runIds.length) await db.insert(s.experimentRuns).values(runIds.map((runId) => ({ experimentId: e.id, runId })));
    return e;
  };
  const M = async (v: typeof s.metrics.$inferInsert) => (await db.insert(s.metrics).values(v).returning())[0];
  const H = (assumptionId: string, experimentId: string, note: string, toStatus?: typeof s.assumptions.$inferSelect.status) =>
    db.insert(s.assumptionHistory).values({ assumptionId, experimentId, note, toStatus });

  // 1. Bar discovery interviews (closed, pivot)
  const bar = await X(
    {
      title: "Bar customer discovery interviews",
      stage: "closed",
      who: "Sports fans at LA sports bars (33 Taps, The Woodman)",
      action: "Describe how they watch games and how they exercise",
      howMany: "25 interviews (coach: baseline, not goal)",
      byWhen: "Late September 2026",
      becauseNote: "We needed primary data on who has the problem before testing the solution.",
      method: "interviews",
      channel: "In person at sports bars",
      sampleSizeTarget: 25,
      startDate: d("2026-09-10"),
      reportDate: d("2026-09-25"),
      scriptId: barScript.id,
      rawLearnings: headline,
      insights: synthesis,
      decision: "pivot",
      decisionNote: "Bar is for finding fans, not for using the product. Shift target to fans who watch at home and own a little equipment. Next: Game Day Pilot.",
      closedAt: d("2026-09-25"),
    },
    [a2.id, a3.id],
    Object.values(barRuns),
  );
  await M({
    experimentId: bar.id, order: 0, name: "Interviews completed", type: "count", source: "Interview log",
    passLine: "25 interviews", passDecision: "Enough data to pick a segment", killLine: "(not set)", killDecision: "(not set)", result: "unclear",
  });
  await H(a3.id, bar.id, "Bar interviews: 'if I'm out here, I'm not gonna do ten pushups at a bar.'", "supported");
  await H(a2.id, bar.id, "Home exercisers averaged 5.6 guessed PAL score vs 4.1 for gym-first.", "testing");

  // 2. August survey (closed)
  const survey = await X(
    {
      title: "August survey",
      stage: "closed",
      who: "Sports fans in Adam's network",
      action: "Answer a Google Form about watching and exercise habits",
      method: "survey",
      channel: "Google Form shared through Adam's network",
      startDate: d("2026-08-10"),
      reportDate: d("2026-08-11"),
      scriptId: surveyScript.id,
      rawLearnings: "7 of 12 respondents already exercise during or around games. Nearly all watch mostly at home, often alone.",
      insights: "Respondents likely came through Adam's network and already knew the concept, so this is a biased read on demand but a good list of early users.",
      decision: "persevere",
      decisionNote: "Use the respondents as the first recruit list.",
      closedAt: d("2026-08-11"),
    },
    [a2.id],
    [surveyRun.id],
  );
  await M({
    experimentId: survey.id, order: 0, name: "Respondents who already exercise around games", type: "rate", source: "Survey answers",
    passLine: "(not set)", passDecision: "(not set)", killLine: "(not set)", killDecision: "(not set)", result: "pass",
  }).then((m) => db.insert(s.metricReadings).values({ metricId: m.id, numerator: 7, denominator: 12, value: 7 / 12, verified: true, date: d("2026-08-11") }));

  // 3. Sprint 1 email sign-up test (closed, pivot)
  const sprint1Run = await R({ name: "Sprint 1 email blast", notes: "Mailchimp send. 32 sends, 93.8% delivered, 46.7% open rate, 6.7% click rate." });
  const sprint1 = await X(
    {
      title: "Sprint 1: email sign-up from warm list",
      stage: "closed",
      who: "Survey respondents who already exercise around games (warm list)",
      action: "Sign up at app.playaction.live",
      howMany: "5 of 10 (ecstatic at 8 of 10)",
      byWhen: "Friday of sprint 1",
      method: "landing_page",
      channel: "Founder email via Mailchimp",
      rawLearnings: section(L, "RESULTS - EXPERIMENT ONE", ["Marketing snapshot"]).text,
      insights: "We need to talk to actual potential customers, rather than friends and family.",
      decision: "pivot",
      decisionNote: "Stop testing on friends and family. Go find real potential customers (led to bar interviews).",
    },
    [a7.id],
    [sprint1Run.id],
  );
  const s1m = await M({
    experimentId: sprint1.id, order: 0, name: "Share of emailed list who sign up", type: "rate", source: "App sign-up database + Mailchimp",
    passLine: "5 of 10", passDecision: "Warm list converts; move on to solution testing", killLine: "(not set)", killDecision: "(not set)", result: "fail",
  });
  await db.insert(s.metricReadings).values({ metricId: s1m.id, value: 1, note: "1 sign-up, source unknown (not from the list that was emailed).", verified: false });
  await H(a7.id, sprint1.id, "1 sign-up from 32 sends, and not from the list.", "refuted");

  // 4. Sprint 2: Google Ads sign-up (running, stale)
  const sprint2 = await X(
    {
      title: "Sprint 2: Google Ads email sign-up",
      stage: "running",
      who: "Casual sports fans who have ambitions for fitness",
      action: "Enter their email on Play Action's site",
      howMany: "10",
      byWhen: "Oct 1, 2026",
      becauseNote: "4 of 12 people we interviewed had already built their own version of this behavior without being prompted.",
      method: "landing_page",
      channel: "Google Ads (primary), Boardy, in-person",
      reportDate: d("2026-10-01"),
      notes: "No results recorded in the coaching doc. " + REVIEW,
    },
    [a12.id, a1.id],
  );
  await M({
    experimentId: sprint2.id, order: 0, name: "Email sign-ups from ads", type: "count", source: "Site sign-up database",
    passLine: "10 by Oct 1", passDecision: "(not set)", killLine: "(not set)", killDecision: "(not set)",
  });

  // 5. Game Day Pilot (not launched; Adam confirmed 2026-10-22 that group events ran instead)
  const pilot = await X(
    {
      title: "Game Day Pilot",
      stage: "experiment",
      who: "20 to 30 home sports fans (survey list, hot bar leads, 1 to 2 friend pods)",
      action: "Use Play Action during real NFL games and come back on their own",
      howMany: "See H1 to H4",
      byWhen: "End of NFL Week 8",
      becauseNote: "Interviews tell us what people say; this tests what they do.",
      method: "pilot",
      channel: "Survey list, bar leads, fantasy league pods",
      sampleSizeTarget: 25,
      startDate: d("2026-10-01"),
      reportDate: d("2026-11-02"),
      notes: "Not launched as a home pilot (confirmed by Adam 2026-10-22). In-person group events ran instead: F45 Broncos on Oct 15, Groundfloor on Oct 29. Dates and recruiting need a fresh plan. " + REVIEW,
    },
    [a1.id, a4.id, a5.id],
  );
  await M({ experimentId: pilot.id, order: 0, name: "H1: complete 1 full session (5+ moments) in week 1", type: "rate", source: "PostHog: moments fired vs completed",
    passLine: "60% or more", passDecision: "People will try it during a real game. Check H2.", killLine: "Under 40%", killDecision: "Onboarding or the in-game experience is broken. Fix it before any more recruiting." });
  await M({ experimentId: pilot.id, order: 1, name: "H2: use it in a 2nd game within 7 days, no reminder", type: "rate", source: "PostHog: games per user per week",
    passLine: "40% or more", passDecision: "Core loop works. Go to beta with the home fan as the lead persona.", killLine: "Under 25%", killDecision: "Novelty without habit. Lean into stakes and pods, or the PT angle, before scaling." });
  await M({ experimentId: pilot.id, order: 2, name: "H3: week-3 active rate, pods vs solo", type: "rate", source: "PostHog cohorts: pod vs solo",
    passLine: "Pods at least 1.5x solo", passDecision: "Build the league leaderboard before beta and recruit through fantasy commissioners.", killLine: "No difference", killDecision: "Skip social features for beta." });
  await M({ experimentId: pilot.id, order: 3, name: "H4: week-3 actives who pay $5 for a season pass", type: "rate", source: "Payment link",
    passLine: "20% or more", passDecision: "(not set in doc) " + REVIEW, killLine: "Near zero", killDecision: "Price is a real wall, as Oscar S. and Steve said." });

  // 6. F45 Broncos activation (closed)
  const f45Run = await R({
    name: "F45 Broncos activation",
    startDate: d("2026-10-15"),
    location: "F45 Sloans Lake, 1525 Raleigh St, Denver",
    notes: "Broncos vs Seahawks, Thu Oct 15, 6:15 PM MT, on Prime.",
  });
  await db.insert(s.evidence).values({ runId: f45Run.id, type: "observation", summary: f45Observations });
  const f45 = await X(
    {
      title: "In-person group exercise test v1 (F45 Broncos)",
      stage: "closed",
      who: "Casual sports fans who have ambitions for fitness",
      action: "Join Play Action for the Broncos game and give their email for the beta list",
      howMany: "5 of 10 eligible attendees (ecstatic at 8 of 10)",
      byWhen: "Oct 15, 2026",
      becauseNote: "4 of 12 people we interviewed had already built their own version of this behavior without being prompted and without knowing Play Action existed.",
      method: "event",
      channel: "Eventbrite, F45 member list, LinkedIn post, Denver network",
      sampleSizeTarget: 10,
      startDate: d("2026-10-15"),
      reportDate: d("2026-10-19"),
      rawLearnings: f45Observations,
      insights: f45Clean,
      decision: "persevere",
      decisionNote: "Keep the format, fix recruiting: run the next session at Groundfloor and get personal yeses.",
      closedAt: d("2026-10-21"),
    },
    [a1.id, a4.id, a8.id, a10.id],
    [f45Run.id, patrickRun.id],
  );
  await M({ experimentId: f45.id, order: 0, name: "Eligible attendees who opt into beta emails", type: "rate", source: "Observer tally",
    passLine: "5 of 10 or more", passDecision: "Demand holds in a group setting. Scale group sessions.", killLine: "Fewer than 5 attendees", killDecision: "Run as observed discovery session; hypothesis untested.", result: "unclear" });
  const evM = await M({ experimentId: f45.id, order: 1, name: "Eventbrite page view to free ticket", type: "rate", source: "Eventbrite traffic report",
    passLine: "(not set)", passDecision: "(not set)", killLine: "(not set)", killDecision: "(not set)", result: "fail" });
  await db.insert(s.metricReadings).values({ metricId: evM.id, numerator: 3, denominator: 95, value: 3 / 95, verified: true, date: d("2026-10-15"), note: "All 3 came from Eventbrite search." });
  const showM = await M({ experimentId: f45.id, order: 2, name: "Ticket holders who showed up", type: "rate", source: "Observer tally",
    passLine: "(not set)", passDecision: "(not set)", killLine: "(not set)", killDecision: "(not set)", result: "fail" });
  await db.insert(s.metricReadings).values({ metricId: showM.id, numerator: 0, denominator: 3, value: 0, verified: true, date: d("2026-10-15"), note: "The 2 attendees (Bradley, Darby) did not come through Eventbrite." });
  await H(a8.id, f45.id, "95 page views, 3 free tickets, 0 ticket holders attended.", "refuted");
  await H(a10.id, f45.id, "Both attendees lost steam during ~20 minutes with no game action.", "refuted");
  await H(a4.id, f45.id, "Bradley and Darby would only use it as a couple; Bradley wants a competitive layer.");
  await H(a1.id, f45.id, "Both did the movements when prompted; Bradley reopened the app on his own the next Sunday.");

  // 7. Groundfloor group test v2 (hypothesis)
  const gf = await X(
    {
      title: "In-person group exercise test v2 (Groundfloor)",
      stage: "hypothesis",
      who: "Casual sports fans at Groundfloor co-working",
      action: "Sign up, then attend a group session in the Groundfloor fitness room for MNF or TNF",
      howMany: "20 sign up, 10 attend",
      byWhen: "Oct 29, 2026",
      becauseNote: gfBecause,
      method: "event",
      channel: "Face-to-face invites at Groundfloor",
      startDate: d("2026-10-29"),
      notes: "Coach comment 2026-10-21: separate the top-of-funnel experiments from the actual test; get 10 to 15 more rows in the database first.",
    },
    [a1.id, a4.id, a9.id],
  );

  // 8. PT clinic side test (hypothesis)
  const pt = await X(
    {
      title: "PT clinic side test",
      stage: "hypothesis",
      who: "LA physical therapy clinics and their patients",
      action: "Clinic hands a one-page leave-behind to patients; patients sign up",
      howMany: "At least 1 clinic agrees and at least 3 patients sign up",
      byWhen: "3 weeks after the clinic visits",
      becauseNote: "Matia's PT told him to stretch during games; Oscar S. quit PT.",
      method: "other",
      channel: "Visits to 3 LA PT clinics",
    },
    [a6.id],
  );

  // ---- open questions + coach comment ----
  if (newQuestions.length) await db.insert(s.openQuestions).values(newQuestions.map((text) => ({ text })));
  await db.insert(s.comments).values({
    experimentId: gf.id,
    role: "coach",
    authorName: "Coach (from Google Doc)",
    body: "Let's separate the experiments into the top of funnel and the actual test. Let's get 10-15 more rows in the database and THEN or and ALSO plan for the second version of the in person test.",
    createdAt: new Date("2026-10-21T16:00:00Z"),
  });

  // ---- report ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (t: any) => (await db.execute(sql`select count(*)::int as n from ${t}`))[0].n;
  console.log({
    people: await count(s.people),
    interviews: await count(s.interviews),
    surveyResponses: surveyCount,
    answers: await count(s.answers),
    questions: await count(s.questions),
    scripts: await count(s.scripts),
    assumptions: await count(s.assumptions),
    experiments: await count(s.experiments),
    metrics: await count(s.metrics),
    runs: await count(s.runs),
    openQuestions: await count(s.openQuestions),
    summariesMatched: Object.values(summaries).filter(Boolean).length,
    summaryLengths: Object.fromEntries(Object.entries(summaries).map(([k, v]) => [k, v.length])),
    ptClinic: pt.title,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
