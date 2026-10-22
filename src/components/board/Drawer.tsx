"use client";
// Card drawer. Sections appear as the card reaches each column (progressive disclosure);
// the current column's section is open, earlier ones are collapsed.
import { useState } from "react";
import Link from "next/link";
import type { BoardCard } from "@/lib/board-data";
import { blockedMessage, checkMove, filled, FLOW, missingFor, toGateCard, type Stage } from "@/lib/gates";
import { fmtDate, pct, STAGE_LABELS, STATUS_STYLES } from "@/lib/format";
import { Pill, SeedFlag } from "@/components/ui";
import * as A from "@/app/actions";
import { Button, dateInput, inputCls, Label, SelectInput, TextInput, useAction } from "./fields";

export type Lists = {
  assumptions: { id: string; statement: string; status: string; category: string; importance: number; evidence: number }[];
  runs: { id: string; name: string; startDate: Date | null }[];
  scripts: { id: string; name: string; versionLabel: string }[];
};

type Metric = BoardCard["metrics"][number];

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x.replace("_", " ") }));
const METHODS = ["interviews", "survey", "pilot", "landing_page", "event", "concierge", "other"] as const;
const CATEGORIES = ["customer", "problem", "solution", "channel", "revenue", "other"] as const;
const STATUSES = ["untested", "testing", "supported", "refuted", "retired"] as const;
const EVIDENCE_TYPES = ["observation", "interview", "metric_reading", "survey_response", "other"] as const;
const SCORES = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export function Drawer({
  card,
  focus,
  lists,
  siblings,
  onClose,
  onOpen,
}: {
  card: BoardCard;
  focus?: Stage; // the step that was clicked on the board, opened along with the current one
  lists: Lists;
  siblings: BoardCard[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { run } = useAction();
  const save = (field: string) => (v: string) => run(() => A.updateCard(card.id, field, v));
  const reached = FLOW.indexOf(card.stage);
  const sectionProps = { card, lists, save };

  const sections: { stage: Stage; body: React.ReactNode }[] = [
    { stage: "assumption", body: <AssumptionSection {...sectionProps} /> },
    { stage: "hypothesis", body: <HypothesisSection {...sectionProps} onOpen={onOpen} /> },
    {
      stage: "experiment",
      body: (
        <>
          <ExperimentSection {...sectionProps} />
          <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Metrics</h4>
          <MetricsSection {...sectionProps} />
        </>
      ),
    },
    { stage: "running", body: <RunningSection {...sectionProps} /> },
    { stage: "results", body: <ResultsSection {...sectionProps} /> },
    { stage: "decision", body: <DecisionSection {...sectionProps} /> },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-line bg-surface px-5 py-3">
          <div className="flex items-center gap-2">
            <Pill>{STAGE_LABELS[card.stage]}</Pill>
            {card.decision && <Pill className="bg-orange-100 text-orange-800">{card.decision}</Pill>}
            <SeedFlag tags={card.tags} />
            <Link href={`/experiments/${card.id}`} className="ml-auto text-xs text-muted hover:text-ink">
              Full page
            </Link>
            <button onClick={onClose} className="text-xl leading-none text-muted hover:text-ink" aria-label="Close">
              ×
            </button>
          </div>
          <input
            className="mt-2 w-full bg-transparent text-lg font-semibold focus:outline-none"
            defaultValue={card.title}
            onBlur={(e) => e.target.value !== card.title && save("title")(e.target.value)}
          />
          {siblings.length > 0 && (
            <div className="mt-1 text-xs text-muted">
              Split from the same hypothesis as:{" "}
              {siblings.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <button className="underline hover:text-ink" onClick={() => onOpen(s.id)}>
                    {s.title}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <GateBox card={card} onOpen={onOpen} />
          {sections
            .filter((s) => FLOW.indexOf(s.stage) <= reached)
            .map((s) => (
              <Section key={`${s.stage}-${card.stage}`} stage={s.stage} card={card} startOpen={s.stage === card.stage || s.stage === focus}>
                {s.body}
              </Section>
            ))}
          {card.notes && <p className="mb-3 whitespace-pre-wrap text-xs text-muted">Notes: {card.notes}</p>}
          {card.comments.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Comments</h3>
              {card.comments.map((c) => (
                <div key={c.id} className="mb-2 rounded-md border border-line bg-white p-3 text-sm">
                  <div className="text-xs text-muted">
                    {c.authorName ?? c.role}, {fmtDate(c.createdAt)}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/** One column's inputs. Starts open for the card's current column, collapsed for earlier ones. */
function Section({ stage, card, startOpen, children }: { stage: Stage; card: BoardCard; startOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  const n = missingFor(stage, toGateCard(card)).length;
  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-line bg-surface" style={{ borderLeft: `4px solid var(--color-stage-${stage})` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold"
      >
        <span>
          <span className="mr-2 inline-block w-3 text-muted">{open ? "−" : "+"}</span>
          {STAGE_LABELS[stage]}
        </span>
        {n ? <span className="text-xs font-normal text-amber-700">{n} to fill</span> : <span className="text-xs font-normal text-green-700">Done</span>}
      </button>
      {open && <div className="border-t border-line px-4 py-3">{children}</div>}
    </section>
  );
}

/** What it takes to move on, plus forward and back buttons. */
function GateBox({ card, onOpen }: { card: BoardCard; onOpen: (id: string) => void }) {
  const { run, pending } = useAction();
  const idx = FLOW.indexOf(card.stage);
  if (card.stage === "closed") {
    return (
      <div className="mb-4 rounded-lg border border-line bg-white p-3 text-sm">
        This experiment is closed{card.closedAt ? ` (${fmtDate(card.closedAt)})` : ""}. It stays searchable.
        <div className="mt-2 flex flex-wrap gap-2">
          <Button kind="primary" onClick={() => run(() => A.createNextExperiment(card.id), (r) => r.ok && r.id && onOpen(r.id))} disabled={pending}>
            Create next experiment
          </Button>
          <Button onClick={() => run(() => A.moveCard(card.id, "decision"))} disabled={pending}>
            Reopen in Decision
          </Button>
        </div>
      </div>
    );
  }
  const next = FLOW[idx + 1];
  const prev = idx > 0 ? FLOW[idx - 1] : null;
  const missing = missingFor(card.stage, toGateCard(card));
  const check = checkMove(toGateCard(card), next);
  return (
    <div className={`mb-4 rounded-lg border p-3 text-sm ${missing.length ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
      {missing.length ? (
        <>
          <div className="font-medium">Before this can expand into {STAGE_LABELS[next] ?? "closing"}:</div>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="font-medium">{next === "closed" ? "Ready to close." : `Ready to expand into ${STAGE_LABELS[next]}.`}</div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button kind="primary" disabled={pending || !check.ok} onClick={() => run(() => A.moveCard(card.id, next))}>
          {next === "closed" ? "Close experiment" : `Expand into ${STAGE_LABELS[next]}`}
        </Button>
        {prev && (
          <Button disabled={pending} onClick={() => run(() => A.moveCard(card.id, prev))}>
            Back to {STAGE_LABELS[prev]}
          </Button>
        )}
      </div>
      {!check.ok && check.stage !== card.stage && <p className="mt-2 text-xs text-muted">{blockedMessage(check)}</p>}
    </div>
  );
}

type SectionProps = { card: BoardCard; lists: Lists; save: (field: string) => (v: string) => void };

// ---------- Assumption ----------

function AssumptionSection({ card, lists }: SectionProps) {
  const { run, pending } = useAction();
  const linked = new Set(card.assumptions.map((a) => a.id));
  const [draft, setDraft] = useState({ statement: "", category: "other", importance: 3, evidence: 1 });
  return (
    <div>
      {card.assumptions.length === 0 && <p className="mb-2 text-sm text-muted">No assumptions linked yet.</p>}
      {card.assumptions.map((a) => (
        <div key={a.id} className="mb-2 flex items-start gap-2 text-sm">
          <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
          <span className="flex-1">{a.statement}</span>
          <button className="text-xs text-muted hover:text-red-700" onClick={() => run(() => A.unlinkAssumption(card.id, a.id))}>
            Remove
          </button>
        </div>
      ))}
      <Label text="Link an existing assumption">
        <select className={inputCls} value="" onChange={(e) => e.target.value && run(() => A.linkAssumption(card.id, e.target.value))}>
          <option value="">Choose...</option>
          {lists.assumptions
            .filter((a) => !linked.has(a.id))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.statement.length > 90 ? a.statement.slice(0, 90) + "..." : a.statement}
              </option>
            ))}
        </select>
      </Label>
      <form
        className="rounded-md border border-dashed border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => A.createAssumption(card.id, draft), (r) => r.ok && setDraft({ ...draft, statement: "" }));
        }}
      >
        <div className="mb-2 text-xs font-medium text-muted">Or write a new one</div>
        <textarea className={inputCls} rows={2} placeholder="We believe that..." value={draft.statement} onChange={(e) => setDraft({ ...draft, statement: e.target.value })} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Label text="Category">
            <select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Label>
          <Label text="Importance (1 to 5)">
            <select className={inputCls} value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: Number(e.target.value) })}>
              {SCORES.map((o) => (
                <option key={o.value}>{o.value}</option>
              ))}
            </select>
          </Label>
          <Label text="Evidence (1 to 5)">
            <select className={inputCls} value={draft.evidence} onChange={(e) => setDraft({ ...draft, evidence: Number(e.target.value) })}>
              {SCORES.map((o) => (
                <option key={o.value}>{o.value}</option>
              ))}
            </select>
          </Label>
        </div>
        <Button type="submit" disabled={pending || !draft.statement.trim()}>
          Add assumption
        </Button>
      </form>
    </div>
  );
}

// ---------- Hypothesis ----------

function HypothesisSection({ card, save, onOpen }: SectionProps & { onOpen: (id: string) => void }) {
  const { run, pending } = useAction();
  return (
    <div>
      <TextInput label="Who" value={card.who} onSave={save("who")} required />
      <TextInput label="Will do what (action)" value={card.action} onSave={save("action")} required />
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="How many" value={card.howMany} onSave={save("howMany")} required />
        <TextInput label="By when" value={card.byWhen} onSave={save("byWhen")} required />
      </div>
      <div className="mb-1 text-xs font-medium text-muted">
        Because<span className="text-accent"> *</span>
      </div>
      {card.assumptions.length ? (
        <ul className="mb-2 list-disc pl-5 text-sm">
          {card.assumptions.map((a) => (
            <li key={a.id}>{a.statement}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-muted">Linked assumptions show here.</p>
      )}
      <TextInput label="Anything to add to the because" value={card.becauseNote} onSave={save("becauseNote")} multiline />
      {card.stage === "hypothesis" && (
        <div className="rounded-md bg-stone-50 p-3 text-sm">
          <p className="mb-2 text-muted">Want to test this assumption more than one way at the same time? Split makes a sibling card with the same assumptions and hypothesis.</p>
          <Button disabled={pending} onClick={() => run(() => A.splitCard(card.id), (r) => r.ok && r.id && onOpen(r.id))}>
            Split into a sibling card
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Experiment ----------

function ExperimentSection({ card, lists, save }: SectionProps) {
  const needsScript = card.method === "interviews" || card.method === "survey";
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <SelectInput label="Method" value={card.method} options={opts(METHODS)} onSave={save("method")} required />
        <TextInput label="Channel" value={card.channel} onSave={save("channel")} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <TextInput label="Sample size" type="number" value={card.sampleSizeTarget} onSave={save("sampleSizeTarget")} />
        <TextInput label="Start date" type="date" value={dateInput(card.startDate)} onSave={save("startDate")} required />
        <TextInput label="Report date" type="date" value={dateInput(card.reportDate)} onSave={save("reportDate")} required />
      </div>
      <SelectInput
        label={needsScript ? "Script (needed for interviews and surveys)" : "Script"}
        value={card.scriptId}
        options={lists.scripts.map((s) => ({ value: s.id, label: `${s.name} ${s.versionLabel}` }))}
        onSave={save("scriptId")}
        required={needsScript}
        blank="No script"
      />
    </div>
  );
}

// ---------- Metrics ----------

function MetricsSection({ card }: SectionProps) {
  const { run, pending } = useAction();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Every metric needs a source, and a decision for both the pass line and the kill line.</p>
      {card.metrics.map((m) => (
        <MetricEditor key={m.id} metric={m} />
      ))}
      <Button disabled={pending} onClick={() => run(() => A.addMetric(card.id))}>
        Add metric
      </Button>
    </div>
  );
}

function MetricEditor({ metric: m }: { metric: Metric }) {
  const { run } = useAction();
  const save = (field: string) => (v: string) => run(() => A.updateMetric(m.id, field, v));
  return (
    <div className="mb-3 rounded-md border border-line p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <TextInput label="Name" value={m.name} onSave={save("name")} required />
        </div>
        <SelectInput label="Type" value={m.type} options={opts(["rate", "count", "score"])} onSave={save("type")} blank="rate" />
      </div>
      {m.type === "count" && (
        <p className="-mt-1 mb-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Counts only go up. What would you do differently at 2 vs 12?</p>
      )}
      <TextInput label="Source" value={m.source} onSave={save("source")} required placeholder='Required, for example "PostHog: session_completed"' />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <TextInput label="Pass line" value={m.passLine} onSave={save("passLine")} required />
          <TextInput label="If it passes, we will" value={m.passDecision} onSave={save("passDecision")} required multiline />
        </div>
        <div>
          <TextInput label="Kill line" value={m.killLine} onSave={save("killLine")} required />
          <TextInput label="If it fails, we will" value={m.killDecision} onSave={save("killDecision")} required multiline />
        </div>
      </div>
      <button
        className="text-xs text-muted hover:text-red-700"
        onClick={() => confirm(`Delete the metric "${m.name}" and its readings?`) && run(() => A.deleteMetric(m.id))}
      >
        Delete metric
      </button>
    </div>
  );
}

// ---------- Running ----------

function RunningSection({ card, lists }: SectionProps) {
  const { run, pending } = useAction();
  const linked = new Set(card.runs.map((r) => r.id));
  const [newRun, setNewRun] = useState({ name: "", date: "" });
  const [ev, setEv] = useState({ runId: "", type: "observation", summary: "" });
  const allEvidence = card.runs.flatMap((r) => r.evidence.map((e) => ({ ...e, runName: r.name })));
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Sessions</h4>
      {card.runs.length === 0 && <p className="mb-2 text-sm text-muted">No sessions linked yet. A session is one time you collected data, like an event night or a day of interviews.</p>}
      {card.runs.map((r) => (
        <div key={r.id} className="mb-1 flex items-center gap-2 text-sm">
          <span className="flex-1">
            {r.name} <span className="text-muted">{fmtDate(r.startDate)}</span>
            <span className="text-xs text-muted">
              {" "}
              ({r.evidence.length} evidence)
            </span>
          </span>
          <button className="text-xs text-muted hover:text-red-700" onClick={() => run(() => A.unlinkRun(card.id, r.id))}>
            Unlink
          </button>
        </div>
      ))}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Label text="Link an existing session">
          <select className={inputCls} value="" onChange={(e) => e.target.value && run(() => A.linkRun(card.id, e.target.value))}>
            <option value="">Choose...</option>
            {lists.runs
              .filter((r) => !linked.has(r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.startDate ? ` (${fmtDate(r.startDate)})` : ""}
                </option>
              ))}
          </select>
        </Label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => A.createRun(card.id, newRun), (r) => r.ok && setNewRun({ name: "", date: "" }));
          }}
        >
          <span className="mb-1 block text-xs font-medium text-muted">Or add a new session</span>
          <input className={inputCls} placeholder="Session name" value={newRun.name} onChange={(e) => setNewRun({ ...newRun, name: e.target.value })} />
          <div className="mt-1 flex gap-1">
            <input className={inputCls} type="date" value={newRun.date} onChange={(e) => setNewRun({ ...newRun, date: e.target.value })} />
            <Button type="submit" disabled={pending || !newRun.name.trim()}>
              Add
            </Button>
          </div>
        </form>
      </div>

      {card.runs.length > 0 && (
        <form
          className="mt-3 rounded-md border border-dashed border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => A.addEvidence(ev.runId || card.runs[0].id, ev), (r) => r.ok && setEv({ ...ev, summary: "" }));
          }}
        >
          <div className="mb-2 text-xs font-medium text-muted">Add evidence</div>
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={ev.runId || card.runs[0].id} onChange={(e) => setEv({ ...ev, runId: e.target.value })}>
              {card.runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select className={inputCls} value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })}>
              {opts(EVIDENCE_TYPES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <textarea className={`${inputCls} mt-2`} rows={2} placeholder="What you saw or heard" value={ev.summary} onChange={(e) => setEv({ ...ev, summary: e.target.value })} />
          <Button type="submit" disabled={pending || !ev.summary.trim()}>
            Add evidence
          </Button>
        </form>
      )}

      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Readings</h4>
      {card.metrics.length === 0 && <p className="text-sm text-muted">No metrics yet.</p>}
      {card.metrics.map((m) => (
        <ReadingForm key={m.id} metric={m} evidence={allEvidence} />
      ))}
    </div>
  );
}

function Readings({ metric: m }: { metric: Metric }) {
  if (m.readings.length === 0) return <p className="text-xs text-muted">No readings yet.</p>;
  return (
    <ul className="space-y-0.5 text-sm">
      {m.readings.map((r) => (
        <li key={r.id}>
          {r.numerator != null && r.denominator != null ? `${r.numerator} of ${r.denominator} (${pct(r.numerator, r.denominator)})` : r.value}
          <span className="text-xs text-muted"> on {fmtDate(r.date)}</span>
          {!r.verified && <Pill className="ml-2 bg-yellow-100 text-yellow-800">unverified</Pill>}
          {r.note && <span className="ml-2 text-xs text-muted">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function ReadingForm({ metric: m, evidence }: { metric: Metric; evidence: { id: string; summary: string | null; runName: string }[] }) {
  const { run, pending } = useAction();
  const blank = { numerator: "", denominator: "", value: "", date: "", note: "", evidenceId: "" };
  const [v, setV] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="mb-3 rounded-md border border-line p-3">
      <div className="mb-1 text-sm font-medium">{m.name}</div>
      <Readings metric={m} />
      <form
        className="mt-2 flex flex-wrap items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => A.addReading(m.id, v), (r) => r.ok && setV(blank));
        }}
      >
        {m.type === "rate" ? (
          <>
            <input className={`${inputCls} w-16`} placeholder="count" value={v.numerator} onChange={set("numerator")} inputMode="numeric" />
            <span className="pb-1.5 text-sm text-muted">of</span>
            <input className={`${inputCls} w-16`} placeholder="total" value={v.denominator} onChange={set("denominator")} inputMode="numeric" />
          </>
        ) : (
          <input className={`${inputCls} w-20`} placeholder="value" value={v.value} onChange={set("value")} inputMode="decimal" />
        )}
        <input className={`${inputCls} w-36`} type="date" value={v.date} onChange={set("date")} />
        <input className={`${inputCls} w-32 flex-1`} placeholder="note" value={v.note} onChange={set("note")} />
        <select className={`${inputCls} w-full`} value={v.evidenceId} onChange={set("evidenceId")}>
          <option value="">No evidence linked (shows as unverified)</option>
          {evidence.map((e) => (
            <option key={e.id} value={e.id}>
              {e.runName}: {(e.summary ?? "").slice(0, 70)}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          Record reading
        </Button>
      </form>
    </div>
  );
}

// ---------- Results ----------

function ResultsSection({ card, save }: SectionProps) {
  const { run } = useAction();
  return (
    <div>
      {card.metrics.map((m) => (
        <div key={m.id} className="mb-3 rounded-md border border-line p-3">
          <div className="text-sm font-medium">{m.name}</div>
          <div className="my-1 grid grid-cols-2 gap-2 text-xs">
            <div className="text-green-800">Pass: {filled(m.passLine) ? m.passLine : "not set"}</div>
            <div className="text-red-800">Kill: {filled(m.killLine) ? m.killLine : "not set"}</div>
          </div>
          <Readings metric={m} />
          <div className="mt-2">
            <SelectInput
              label="Result"
              value={m.result}
              options={opts(["pass", "fail", "unclear"])}
              onSave={(v) => run(() => A.updateMetric(m.id, "result", v))}
              required
            />
          </div>
        </div>
      ))}
      <TextInput label="Raw learnings (what happened, before interpreting it)" value={card.rawLearnings} onSave={save("rawLearnings")} multiline required />
      <TextInput
        label="Insights (what it means)"
        value={card.insights}
        onSave={save("insights")}
        multiline
        disabled={!filled(card.rawLearnings)}
        placeholder={filled(card.rawLearnings) ? "" : "Write the raw learnings first"}
      />
    </div>
  );
}

// ---------- Decision ----------

function DecisionSection({ card, save }: SectionProps) {
  return (
    <div>
      <SelectInput label="Decision" value={card.decision} options={opts(["persevere", "pivot", "kill"])} onSave={save("decision")} required />
      <TextInput label="Decision note" value={card.decisionNote} onSave={save("decisionNote")} multiline />
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Update each linked assumption</h4>
      {card.assumptions.map((a) => (
        <AssumptionUpdate key={a.id} card={card} assumption={a} />
      ))}
    </div>
  );
}

function AssumptionUpdate({ card, assumption: a }: { card: BoardCard; assumption: BoardCard["assumptions"][number] }) {
  const { run, pending } = useAction();
  const [v, setV] = useState({ evidence: a.evidence, status: a.status as string, note: "" });
  const entries = card.history.filter((h) => h.assumptionId === a.id);
  return (
    <div className="mb-3 rounded-md border border-line p-3 text-sm">
      <div className="flex items-start gap-2">
        <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
        <span className="flex-1">{a.statement}</span>
      </div>
      <div className="mt-1 text-xs text-muted">
        Importance {a.importance}, evidence {a.evidence}
      </div>
      {entries.map((h) => (
        <div key={h.id} className="mt-1 text-xs text-green-800">
          Updated by this experiment: evidence {h.fromEvidence} to {h.toEvidence}, {h.fromStatus} to {h.toStatus}
          {h.note ? `. ${h.note}` : ""}
        </div>
      ))}
      <form
        className="mt-2 grid grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => A.updateAssumptionFromDecision(card.id, a.id, v), (r) => r.ok && setV({ ...v, note: "" }));
        }}
      >
        <Label text="New evidence (1 to 5)">
          <select className={inputCls} value={v.evidence} onChange={(e) => setV({ ...v, evidence: Number(e.target.value) })}>
            {SCORES.map((o) => (
              <option key={o.value}>{o.value}</option>
            ))}
          </select>
        </Label>
        <Label text="New status">
          <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Label>
        <Label text="Why">
          <input className={inputCls} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        </Label>
        <div className="col-span-3">
          <Button type="submit" disabled={pending}>
            {entries.length ? "Record another update" : "Record update"}
          </Button>
        </div>
      </form>
    </div>
  );
}
