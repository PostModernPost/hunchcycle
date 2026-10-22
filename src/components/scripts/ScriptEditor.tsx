"use client";
// Edit one script version: order, wording, add from the bank or write new, and copy to a new version.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, inputCls, Label, Reveal, TextInput, useAction } from "@/components/board/fields";
import {
  addNewQuestionToScript,
  addQuestionToScript,
  copyToNewVersion,
  createQuestion,
  createScript,
  moveInScript,
  removeFromScript,
  setWording,
  updateQuestion,
  updateScript,
} from "@/app/scripts/actions";

type Props = {
  script: { id: string; name: string; versionLabel: string; notes: string | null; parent: { id: string; label: string } | null };
  questions: { id: string; questionId: string; text: string; bankText: string }[];
  bank: { id: string; text: string }[];
  interviewCount: number;
};

export function ScriptEditor({ script: x, questions, bank, interviewCount }: Props) {
  const router = useRouter();
  const { run, pending } = useAction();
  const locked = interviewCount > 0;
  const inScript = new Set(questions.map((q) => q.questionId));
  const [newText, setNewText] = useState("");

  const copy = (
    <Button kind={locked ? "primary" : "secondary"} disabled={pending} onClick={() => run(() => copyToNewVersion(x.id), (r) => r.ok && r.id && router.push(`/scripts/${r.id}`))}>
      Copy to a new version
    </Button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {copy}
        {x.parent && (
          <span className="text-sm text-muted">
            Copied from{" "}
            <Link href={`/scripts/${x.parent.id}`} className="underline hover:text-ink">
              {x.parent.label}
            </Link>
          </span>
        )}
      </div>

      {locked && (
        <p className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {interviewCount} interview{interviewCount === 1 ? " uses" : "s use"} this version, so its questions are locked to keep those interviews intact. To change the
          questions, copy it to a new version.
        </p>
      )}

      <div className="mb-4 grid gap-x-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextInput label="Script name" value={x.name} onSave={(v) => run(() => updateScript(x.id, "name", v))} required />
        </div>
        <TextInput label="Version" value={x.versionLabel} onSave={(v) => run(() => updateScript(x.id, "versionLabel", v))} required />
      </div>
      <TextInput label="Notes" value={x.notes} onSave={(v) => run(() => updateScript(x.id, "notes", v))} />

      <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-muted">Questions ({questions.length})</h2>
      <ol className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-start gap-2 rounded-md border border-line bg-surface p-2">
            <span className="w-6 pt-1.5 text-right text-sm text-muted">{i + 1}.</span>
            <div className="flex-1">
              {locked ? (
                <div className="pt-1.5 text-sm">{q.text}</div>
              ) : (
                <input
                  key={q.text}
                  className={`${inputCls} bg-transparent`}
                  defaultValue={q.text}
                  title="Wording for this script only"
                  onBlur={(e) => e.target.value !== q.text && run(() => setWording(q.id, e.target.value))}
                />
              )}
              <div className="mt-0.5 text-xs text-muted">
                {q.text !== q.bankText && <>Bank wording: &quot;{q.bankText}&quot;. </>}
                <Link href={`/questions/${q.questionId}`} className="underline hover:text-ink">
                  All answers
                </Link>
              </div>
            </div>
            {!locked && (
              <div className="flex shrink-0 items-center gap-1 pt-1">
                <button className="px-1 text-muted hover:text-ink disabled:opacity-30" aria-label="Move up" disabled={i === 0 || pending} onClick={() => run(() => moveInScript(q.id, "up"))}>
                  ↑
                </button>
                <button
                  className="px-1 text-muted hover:text-ink disabled:opacity-30"
                  aria-label="Move down"
                  disabled={i === questions.length - 1 || pending}
                  onClick={() => run(() => moveInScript(q.id, "down"))}
                >
                  ↓
                </button>
                <button className="px-1 text-xs text-muted hover:text-red-700" onClick={() => run(() => removeFromScript(q.id))}>
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {!locked && (
        <div className="mt-3 flex flex-wrap gap-4">
          <select
            className={`${inputCls.replace("w-full ", "")} w-80`}
            value=""
            onChange={(e) => e.target.value && run(() => addQuestionToScript(x.id, e.target.value))}
            aria-label="Add a question from the bank"
          >
            <option value="">+ Add a question from the bank</option>
            {bank
              .filter((q) => !inScript.has(q.id))
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text.length > 90 ? q.text.slice(0, 90) + "..." : q.text}
                </option>
              ))}
          </select>
          <Reveal label="Write a new question">
            {(close) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () => addNewQuestionToScript(x.id, newText),
                    (r) => {
                      if (r.ok) {
                        setNewText("");
                        close();
                      }
                    },
                  );
                }}
              >
                <input className={inputCls} autoFocus value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="It also goes into the question bank" />
                <div className="mt-2">
                  <Button type="submit" disabled={pending || !newText.trim()}>
                    Add question
                  </Button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      )}
    </div>
  );
}

export function NewScript() {
  const router = useRouter();
  const { run, pending } = useAction();
  const [name, setName] = useState("");
  return (
    <Reveal label="New script">
      {() => (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createScript(name),
              (r) => r.ok && r.id && router.push(`/scripts/${r.id}`),
            );
          }}
        >
          <Label text="Name" required>
            <input className={`${inputCls} w-64`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gym interviews" />
          </Label>
          <div className="pb-3">
            <Button type="submit" kind="primary" disabled={pending || !name.trim()}>
              Create
            </Button>
          </div>
        </form>
      )}
    </Reveal>
  );
}

export function NewBankQuestion() {
  const { run, pending } = useAction();
  const [v, setV] = useState({ text: "", tags: "" });
  return (
    <Reveal label="Add a question to the bank">
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createQuestion(v.text, v.tags),
              (r) => {
                if (r.ok) {
                  setV({ text: "", tags: "" });
                  close();
                }
              },
            );
          }}
        >
          <Label text="Question" required>
            <input className={inputCls} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} />
          </Label>
          <Label text="Tags (separate with commas)">
            <input className={inputCls} value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
          </Label>
          <Button type="submit" disabled={pending || !v.text.trim()}>
            Add to bank
          </Button>
        </form>
      )}
    </Reveal>
  );
}

/** Edit a bank question's main wording and tags. Its answers stay attached. */
export function QuestionEditor({ question: q }: { question: { id: string; text: string; tags: string[] } }) {
  const { run } = useAction();
  return (
    <Reveal label="Edit this question">
      {() => (
        <div>
          <TextInput label="Main wording" value={q.text} onSave={(v) => run(() => updateQuestion(q.id, "text", v))} required />
          <TextInput label="Tags (separate with commas)" value={q.tags.join(", ")} onSave={(v) => run(() => updateQuestion(q.id, "tags", v))} />
          <p className="text-xs text-muted">Changing the wording keeps every answer attached, so answers stay comparable across versions.</p>
        </div>
      )}
    </Reveal>
  );
}
