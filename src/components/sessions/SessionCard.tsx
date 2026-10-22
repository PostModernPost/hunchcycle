"use client";
// One session (a run in the BRIEF): details, linked sprints, interference check, and evidence.
import { useState } from "react";
import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { Button, dateInput, inputCls, Label, Reveal, TextInput, useAction } from "@/components/board/fields";
import { addEvidence, linkRun, unlinkRun } from "@/app/actions";
import { createSession, deleteEvidence, toggleEvidenceMetric, updateEvidence, updateSession } from "@/app/sessions/actions";
import { fmtDate } from "@/lib/format";

export type SessionData = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  runBy: string | null;
  notes: string | null;
  recordingLinks: string[];
  interferenceChecked: boolean;
  interferenceNote: string | null;
  sprints: { id: string; name: string; metrics: { id: string; name: string }[] }[];
  evidence: { id: string; type: string; summary: string | null; metricIds: string[]; interview: { id: string; personName: string } | null }[];
};

const EVIDENCE_TYPES = ["observation", "interview", "metric_reading", "survey_response", "other"] as const;
const label = (t: string) => t.replace("_", " ");

export function SessionCard({ session: r, allSprints }: { session: SessionData; allSprints: { id: string; name: string }[] }) {
  const { run, pending } = useAction();
  const save = (field: string) => (v: string) => run(() => updateSession(r.id, field, v));
  const linked = new Set(r.sprints.map((x) => x.id));
  const metrics = r.sprints.flatMap((x) => x.metrics.map((m) => ({ ...m, sprint: x.name })));
  const [ev, setEv] = useState({ type: "observation", summary: "" });

  return (
    <Card className="scroll-mt-4">
      <div id={r.id} className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">
          {[fmtDate(r.startDate) + (r.endDate ? ` to ${fmtDate(r.endDate)}` : ""), r.location, r.runBy && `run by ${r.runBy}`].filter(Boolean).join(", ")}
        </div>
      </div>
      {r.notes && <div className="mt-1 whitespace-pre-wrap text-sm text-muted">{r.notes}</div>}
      {r.recordingLinks.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {r.recordingLinks.map((l) => (
            <a key={l} href={l} target="_blank" rel="noreferrer" className="text-accent underline">
              Recording
            </a>
          ))}
        </div>
      )}

      <Reveal label="Edit details">
        {() => (
          <div>
            <TextInput label="Name" value={r.name} onSave={save("name")} required />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Date (or first day)" type="date" value={dateInput(r.startDate)} onSave={save("startDate")} />
              <TextInput label="Last day (for multi-day sessions)" type="date" value={dateInput(r.endDate)} onSave={save("endDate")} />
              <TextInput label="Location" value={r.location} onSave={save("location")} />
              <TextInput label="Run by" value={r.runBy} onSave={save("runBy")} />
            </div>
            <TextInput label="Notes" value={r.notes} onSave={save("notes")} multiline />
            <TextInput label="Recording links (one per line)" value={r.recordingLinks.join("\n")} onSave={save("recordingLinks")} multiline />
          </div>
        )}
      </Reveal>

      {/* sprints */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted">Sprints:</span>
        {r.sprints.length === 0 && <span className="text-xs text-muted">none yet</span>}
        {r.sprints.map((x) => (
          <Pill key={x.id} className="bg-orange-50 text-orange-900">
            <Link href={`/sprints/${x.id}`} className="hover:underline">
              {x.name}
            </Link>
            <button className="ml-1 text-muted hover:text-red-700" aria-label={`Unlink ${x.name}`} onClick={() => run(() => unlinkRun(x.id, r.id))}>
              ×
            </button>
          </Pill>
        ))}
        <select
          className={`${inputCls.replace("w-full ", "")} w-48 py-0.5 text-xs`}
          value=""
          onChange={(e) => e.target.value && run(() => linkRun(e.target.value, r.id))}
          aria-label="Link a sprint"
        >
          <option value="">+ Link a sprint</option>
          {allSprints
            .filter((x) => !linked.has(x.id))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </div>

      {/* interference check (BRIEF section 5) */}
      {r.sprints.length > 1 && (
        <div className={`mt-3 rounded-md p-3 text-sm ${r.interferenceChecked ? "bg-green-50" : "bg-yellow-100"}`}>
          <div className="font-medium">Could these sprints affect each other&apos;s results?</div>
          <p className="mt-0.5 text-xs text-muted">
            For example, asking for payment at the same event where you measure enjoyment can lower the enjoyment scores.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={r.interferenceChecked} onChange={(e) => run(() => updateSession(r.id, "interferenceChecked", e.target.checked))} />
            We checked, and either they don&apos;t, or we accounted for it
          </label>
          <div className="mt-2">
            <TextInput label="How (optional)" value={r.interferenceNote} onSave={save("interferenceNote")} />
          </div>
        </div>
      )}

      {/* evidence */}
      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Evidence ({r.evidence.length})</h3>
      <div className="space-y-2">
        {r.evidence.map((e) => (
          <EvidenceItem key={e.id} evidence={e} metrics={metrics} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        <Reveal label="Add evidence">
          {(close) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => addEvidence(r.id, ev),
                  (res) => {
                    if (res.ok) {
                      setEv({ ...ev, summary: "" });
                      close();
                    }
                  },
                );
              }}
            >
              <select className={inputCls} value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })}>
                {EVIDENCE_TYPES.filter((t) => t !== "interview").map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
              <textarea className={`${inputCls} mt-2`} rows={3} placeholder="What you saw or heard" value={ev.summary} onChange={(e) => setEv({ ...ev, summary: e.target.value })} />
              <Button type="submit" disabled={pending || !ev.summary.trim()}>
                Add evidence
              </Button>
            </form>
          )}
        </Reveal>
        <Link href={`/interviews/new?session=${r.id}`} className="mt-1 text-sm text-accent hover:brightness-110">
          + Add an interview
        </Link>
      </div>
    </Card>
  );
}

function EvidenceItem({ evidence: e, metrics }: { evidence: SessionData["evidence"][number]; metrics: { id: string; name: string; sprint: string }[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ type: e.type, summary: e.summary ?? "" });
  return (
    <div className="rounded-md border border-line p-2 text-sm">
      <div className="flex flex-wrap items-start gap-2">
        <Pill>{label(e.type)}</Pill>
        {e.interview ? (
          <Link href={`/interviews/${e.interview.id}`} className="font-medium hover:underline">
            {e.interview.personName}
          </Link>
        ) : null}
        {!editing && <span className="line-clamp-3 flex-1 whitespace-pre-wrap text-muted">{e.summary}</span>}
        {!e.interview && !editing && (
          <button className="text-xs text-muted hover:text-ink" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-2">
          <select className={inputCls} value={v.type} onChange={(x) => setV({ ...v, type: x.target.value })}>
            {EVIDENCE_TYPES.filter((t) => t !== "interview").map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
          <textarea className={`${inputCls} mt-2`} rows={3} value={v.summary} onChange={(x) => setV({ ...v, summary: x.target.value })} />
          <div className="mt-1 flex gap-2">
            <Button disabled={pending} onClick={() => run(() => updateEvidence(e.id, v), (r) => r.ok && setEditing(false))}>
              Save
            </Button>
            <Button kind="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <button
              className="ml-auto text-xs text-muted hover:text-red-700"
              onClick={() => confirm("Delete this evidence? This can't be undone.") && run(() => deleteEvidence(e.id))}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted">Counts toward:</span>
          {metrics.map((m) => {
            const on = e.metricIds.includes(m.id);
            return (
              <button
                key={m.id}
                title={m.sprint}
                onClick={() => run(() => toggleEvidenceMetric(e.id, m.id, !on))}
                className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
              >
                {on ? "✓ " : ""}
                {m.name.length > 40 ? m.name.slice(0, 40) + "..." : m.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewSession() {
  const { run, pending } = useAction();
  const blank = { name: "", startDate: "", endDate: "", location: "", runBy: "" };
  const [v, setV] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <Reveal label="New session">
      {(close) => (
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createSession(v),
              (r) => {
                if (r.ok) {
                  setV(blank);
                  close();
                }
              },
            );
          }}
        >
          <Label text="Name" required>
            <input className={inputCls} value={v.name} onChange={set("name")} placeholder="e.g. Groundfloor MNF class" />
          </Label>
          <Label text="Run by">
            <input className={inputCls} value={v.runBy} onChange={set("runBy")} />
          </Label>
          <Label text="Date (or first day)">
            <input className={inputCls} type="date" value={v.startDate} onChange={set("startDate")} />
          </Label>
          <Label text="Last day (optional)">
            <input className={inputCls} type="date" value={v.endDate} onChange={set("endDate")} />
          </Label>
          <Label text="Location">
            <input className={inputCls} value={v.location} onChange={set("location")} />
          </Label>
          <div className="self-end pb-3">
            <Button type="submit" kind="primary" disabled={pending || !v.name.trim()}>
              Add session
            </Button>
          </div>
        </form>
      )}
    </Reveal>
  );
}
