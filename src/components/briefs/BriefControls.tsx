"use client";
// Save a previewed brief, and keep the open-questions list.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Reveal, useAction } from "@/components/board/fields";
import { inputCls } from "@/components/styles";
import { useReadOnly } from "@/components/Role";
import { addOpenQuestion, saveBrief, setQuestionResolved } from "@/app/briefs/actions";

export function SaveBrief({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  if (useReadOnly()) return null;
  return (
    <Button kind="primary" disabled={pending} onClick={() => run(() => saveBrief(from, to), (r) => r.ok && r.id && router.push(`/briefs/${r.id}`))}>
      Save this brief
    </Button>
  );
}

export function OpenQuestions({ questions }: { questions: { id: string; text: string; resolved: boolean }[] }) {
  const { run, pending } = useAction();
  const readOnly = useReadOnly();
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const open = questions.filter((q) => !q.resolved);
  const resolved = questions.filter((q) => q.resolved);
  const row = (q: (typeof questions)[number]) => (
    <li key={q.id} className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={q.resolved}
        disabled={readOnly || pending}
        aria-label="Answered"
        onChange={(e) => run(() => setQuestionResolved(q.id, e.target.checked))}
      />
      <span className={q.resolved ? "text-muted line-through" : ""}>{q.text}</span>
    </li>
  );
  return (
    <div>
      <ul className="space-y-1">{open.map(row)}</ul>
      {open.length === 0 && <p className="text-sm text-muted">No open questions.</p>}
      <Reveal label="Add a question">
        {(close) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addOpenQuestion(text),
                (r) => {
                  if (r.ok) {
                    setText("");
                    close();
                  }
                },
              );
            }}
          >
            <input className={inputCls} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Will Luma fill events better than Eventbrite?" />
            <div className="mt-2">
              <Button type="submit" disabled={pending || !text.trim()}>
                Add
              </Button>
            </div>
          </form>
        )}
      </Reveal>
      {resolved.length > 0 && (
        <div className="mt-2">
          <button className="text-xs text-muted hover:text-ink" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? "Hide" : "Show"} answered ({resolved.length})
          </button>
          {showResolved && <ul className="mt-1 space-y-1">{resolved.map(row)}</ul>}
        </div>
      )}
    </div>
  );
}
