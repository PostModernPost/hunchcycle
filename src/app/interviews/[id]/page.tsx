import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageTitle, Pill } from "@/components/ui";
import { InterviewForm } from "@/components/interviews/InterviewForm";
import { INTERVIEW_TEXT_FIELDS } from "@/lib/interview-fields";
import { blankInterview, loadInterviewLists } from "@/lib/interview-data";
import { dateInput, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [iv, lists] = await Promise.all([
    db.query.interviews.findFirst({ where: eq(s.interviews.id, id), with: { person: true, answers: true, evidence: { with: { run: true } } } }),
    loadInterviewLists(),
  ]);
  if (!iv) notFound();

  const initial = blankInterview({
    id: iv.id,
    personId: iv.personId,
    runId: iv.evidence.runId,
    scriptId: iv.scriptId ?? "",
    date: dateInput(iv.date),
    interviewers: iv.interviewers ?? "",
    recordingDevice: iv.recordingDevice ?? "",
    fields: Object.fromEntries(INTERVIEW_TEXT_FIELDS.map((f) => [f, iv[f] ?? ""])) as ReturnType<typeof blankInterview>["fields"],
    coldHot: iv.coldHot ?? "",
    score: iv.score != null ? String(iv.score) : "",
    scoreSource: iv.scoreSource ?? "asked",
    answers: iv.answers.map((a) => ({ questionId: a.questionId, text: a.text ?? "", asked: a.asked })),
  });

  return (
    <div className="max-w-3xl">
      <Link href={`/people/${iv.personId}`} className="text-sm text-muted hover:text-ink">
        ← {iv.person.name}
      </Link>
      <PageTitle title={`Interview with ${iv.person.name}`} sub={[fmtDate(iv.date), iv.evidence.run.name].filter(Boolean).join(", ")} />
      {iv.evidence.type === "survey_response" && <Pill className="mb-4">survey response</Pill>}
      {iv.scoreSource === "guessed" && iv.score != null && (
        <p className="mb-4 rounded-md bg-yellow-100 px-3 py-2 text-sm text-yellow-800">
          The score of {iv.score} was guessed (for example by AI), so it is shown as unverified and left out of averages unless you include it.
        </p>
      )}
      <InterviewForm initial={initial} {...lists} />
    </div>
  );
}
