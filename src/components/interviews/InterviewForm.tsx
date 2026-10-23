"use client";
// Interview entry form (BRIEF section 6.4): person, session, script, the fixed fields, one answer box per
// script question with an asked toggle, and paste areas for the transcript and summary.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, inputCls, Label, useAction } from "@/components/board/fields";
import { deleteInterview, saveInterview } from "@/app/interviews/actions";
import type { InterviewInput, InterviewTextField } from "@/lib/interview-fields";
import { mapTranscriptToAnswers, TRANSCRIPT_MAPPING_AVAILABLE } from "@/lib/transcript-mapping";
import { fmtDate } from "@/lib/format";
import { EditArea, useReadOnly } from "@/components/Role";

type Script = { id: string; label: string; questions: { questionId: string; text: string }[] };
type Props = {
  initial: InterviewInput;
  people: { id: string; name: string }[];
  sessions: { id: string; name: string; startDate: Date | null }[];
  scripts: Script[];
  questionText: Record<string, string>; // for answers to questions that are not in the chosen script
};

const ASKED = [
  { value: "yes", label: "Asked" },
  { value: "no", label: "Not asked" },
  { value: "not_recorded", label: "Not recorded" },
];

export function InterviewForm({ initial, people, sessions, scripts, questionText }: Props) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const readOnly = useReadOnly();
  const [showMore, setShowMore] = useState(readOnly);
  const isNew = !v.id;

  const script = scripts.find((x) => x.id === v.scriptId);
  const answer = (qid: string) => v.answers.find((a) => a.questionId === qid) ?? { questionId: qid, text: "", asked: "not_recorded" };
  const setAnswer = (qid: string, patch: Partial<{ text: string; asked: string }>) => {
    const current = answer(qid);
    const next = { ...current, ...patch };
    // typing an answer means the question was asked
    if (patch.text && current.asked === "not_recorded") next.asked = "yes";
    setV({ ...v, answers: [...v.answers.filter((a) => a.questionId !== qid), next] });
    setSaved(false);
  };
  const set = <K extends keyof InterviewInput>(k: K, value: InterviewInput[K]) => {
    setV({ ...v, [k]: value });
    setSaved(false);
  };
  const field = (f: InterviewTextField) => ({
    value: v.fields[f] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("fields", { ...v.fields, [f]: e.target.value }),
  });
  const inScript = new Set(script?.questions.map((q) => q.questionId));
  const others = v.answers.filter((a) => !inScript.has(a.questionId) && (a.text || a.asked !== "not_recorded"));

  const save = () =>
    run(
      () => saveInterview(v),
      (r) => {
        if (!r.ok) return;
        if (isNew && r.id) router.push(`/interviews/${r.id}`);
        else setSaved(true);
      },
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <EditArea>
        <Section title="Who and when">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Label text="Person" required>
              <select className={inputCls} value={v.personId} onChange={(e) => set("personId", e.target.value)}>
                <option value="">{isNew ? "Someone new (type their name)" : "Choose..."}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Label>
            {!v.personId ? (
              <Label text="New person's name" required>
                <input className={inputCls} value={v.newPersonName} onChange={(e) => set("newPersonName", e.target.value)} />
              </Label>
            ) : (
              <div className="self-end pb-4 text-sm">
                <Link href={`/people/${v.personId}`} className="text-accent hover:brightness-110">
                  Open their page
                </Link>
              </div>
            )}
            <Label text="Session" required>
              <select className={inputCls} value={v.runId} onChange={(e) => set("runId", e.target.value)}>
                <option value="">Choose...</option>
                {sessions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.startDate ? ` (${fmtDate(r.startDate)})` : ""}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Date">
              <input className={inputCls} type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Label>
            <Label text="Interviewed by">
              <input className={inputCls} value={v.interviewers} onChange={(e) => set("interviewers", e.target.value)} />
            </Label>
            <Label text="Recording device">
              <input className={inputCls} value={v.recordingDevice} onChange={(e) => set("recordingDevice", e.target.value)} placeholder="e.g. DJI Mic 3" />
            </Label>
          </div>
          <Label text="Script">
            <select className={inputCls} value={v.scriptId} onChange={(e) => set("scriptId", e.target.value)}>
              <option value="">No script</option>
              {scripts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </Label>
        </Section>

        {script && (
          <Section title={`Answers (${script.label})`}>
            {script.questions.length === 0 && <p className="text-sm text-muted">This script has no questions yet.</p>}
            {script.questions.map((q, i) => {
              const a = answer(q.questionId);
              return (
                <div key={q.questionId} className="mb-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <Link href={`/questions/${q.questionId}`} className="text-sm font-medium hover:underline">
                      {i + 1}. {q.text}
                    </Link>
                    <select
                      className={`${inputCls.replace("w-full ", "")} w-36 shrink-0 py-1 text-xs`}
                      value={a.asked}
                      onChange={(e) => setAnswer(q.questionId, { asked: e.target.value })}
                      aria-label="Was it asked?"
                    >
                      {ASKED.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea className={inputCls} rows={2} value={a.text} onChange={(e) => setAnswer(q.questionId, { text: e.target.value })} />
                </div>
              );
            })}
          </Section>
        )}
        {others.length > 0 && (
          <Section title="Other answers on record">
            <p className="mb-2 text-xs text-muted">Answers to questions that aren&apos;t in the script chosen above. They are kept.</p>
            {others.map((a) => (
              <div key={a.questionId} className="mb-2 text-sm">
                <Link href={`/questions/${a.questionId}`} className="font-medium hover:underline">
                  {questionText[a.questionId] ?? "Question"}
                </Link>
                <div className="text-muted">{a.text || (a.asked === "no" ? "Not asked" : "Not recorded")}</div>
              </div>
            ))}
          </Section>
        )}

        <Section title="What you learned">
          <Area label="Problem" {...field("problem")} />
          <Area label="Persona" {...field("persona")} />
          <Area label="What surprised you" {...field("surprise")} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Area label="Best quote" {...field("bestQuote")} />
            <Area label="Question that got the quote" {...field("questionThatGotQuote")} />
          </div>
          <Area label="Observation" {...field("observation")} />
          <Area label="Insights" {...field("insights")} />
        </Section>

        <Section title="Where they stand">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Label text="Cold, warm, or hot">
              <select className={inputCls} value={v.coldHot} onChange={(e) => set("coldHot", e.target.value)}>
                <option value="">Not set</option>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
              </select>
            </Label>
            <Label text="Why">
              <input className={inputCls} {...field("coldHotNote")} />
            </Label>
            <Label text="Will they use it, 1 to 10">
              <select className={inputCls} value={v.score} onChange={(e) => set("score", e.target.value)}>
                <option value="">Not scored</option>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Label>
            <Label text="Where the score came from">
              <select className={inputCls} value={v.scoreSource} onChange={(e) => set("scoreSource", e.target.value)} disabled={!v.score}>
                <option value="asked">Asked them out loud</option>
                <option value="guessed">Guessed (shows as unverified)</option>
              </select>
            </Label>
          </div>
          <Label text="Score note">
            <input className={inputCls} {...field("scoreNote")} />
          </Label>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Label text="Next action">
              <input className={inputCls} {...field("nextAction")} />
            </Label>
            <Label text="Stage">
              <input className={inputCls} {...field("stage")} placeholder="e.g. follow up for pilot" />
            </Label>
          </div>
          <button type="button" hidden={readOnly} className="text-sm text-accent hover:brightness-110" onClick={() => setShowMore(!showMore)}>
            {showMore ? "Hide" : "+ Show"} more fields (comments, method, solution, sale)
          </button>
          {showMore && (
            <div className="mt-3">
              <Area label="Comments" {...field("comments")} />
              <div className="grid gap-x-3 sm:grid-cols-3">
                <Label text="Method">
                  <input className={inputCls} {...field("method")} />
                </Label>
                <Label text="Solution">
                  <input className={inputCls} {...field("solution")} />
                </Label>
                <Label text="Sale">
                  <input className={inputCls} {...field("sale")} />
                </Label>
              </div>
            </div>
          )}
        </Section>

        <Section title="Transcript and summary">
          <p className="mb-2 text-xs text-muted">Paste from Plaud or anywhere else.</p>
          <Area label="Transcript" rows={6} {...field("transcriptText")} />
          <div className="mb-3">
            <Button
              disabled={!TRANSCRIPT_MAPPING_AVAILABLE}
              onClick={() => {
                const found = mapTranscriptToAnswers(v.fields.transcriptText ?? "", script?.questions ?? []);
                for (const [qid, text] of Object.entries(found)) setAnswer(qid, { text });
              }}
            >
              Fill from transcript (coming later)
            </Button>
          </div>
          <Area label="Summary" rows={6} {...field("summaryText")} />
        </Section>
      </EditArea>
      <div hidden={readOnly} className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-paper px-4 py-3">
        <Button type="submit" kind="primary" disabled={pending}>
          {isNew ? "Save interview" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
        {!isNew && (
          <button
            type="button"
            className="ml-auto text-xs text-muted hover:text-red-700"
            onClick={() =>
              confirm("Delete this interview and its answers? The person stays. This can't be undone.") &&
              run(
                () => deleteInterview(v.id!),
                (r) => r.ok && r.id && router.push(`/people/${r.id}`),
              )
            }
          >
            Delete interview
          </button>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  return (
    <Label text={label}>
      <textarea className={inputCls} rows={rows} value={value} onChange={onChange} />
    </Label>
  );
}
