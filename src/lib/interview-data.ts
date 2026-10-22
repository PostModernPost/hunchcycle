// Lists the interview form needs. Server only.
import { db } from "@/db";
import { INTERVIEW_TEXT_FIELDS, type InterviewInput } from "@/lib/interview-fields";

export async function loadInterviewLists() {
  const [people, sessions, scripts, questions] = await Promise.all([
    db.query.people.findMany({ columns: { id: true, name: true }, orderBy: (p, { asc }) => [asc(p.name)] }),
    db.query.runs.findMany({ columns: { id: true, name: true, startDate: true } }),
    db.query.scripts.findMany({ with: { questions: { with: { question: true }, orderBy: (q, { asc }) => [asc(q.order)] } }, orderBy: (x, { asc }) => [asc(x.name), asc(x.createdAt)] }),
    db.query.questions.findMany({ columns: { id: true, text: true } }),
  ]);
  sessions.sort((a, b) => (b.startDate?.getTime() ?? -Infinity) - (a.startDate?.getTime() ?? -Infinity));
  return {
    people,
    sessions,
    scripts: scripts.map((x) => ({
      id: x.id,
      label: `${x.name} ${x.versionLabel}`,
      questions: x.questions.map((q) => ({ questionId: q.questionId, text: q.wordingOverride ?? q.question.text })),
    })),
    questionText: Object.fromEntries(questions.map((q) => [q.id, q.text])),
  };
}

export function blankInterview(v: Partial<InterviewInput> = {}): InterviewInput {
  return {
    personId: "",
    newPersonName: "",
    runId: "",
    scriptId: "",
    date: "",
    interviewers: "",
    recordingDevice: "",
    fields: Object.fromEntries(INTERVIEW_TEXT_FIELDS.map((f) => [f, ""])) as InterviewInput["fields"],
    coldHot: "",
    score: "",
    scoreSource: "asked",
    answers: [],
    ...v,
  };
}
