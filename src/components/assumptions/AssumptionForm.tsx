"use client";
// Add an assumption, or edit one. Changing evidence or status by hand is logged in its history.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputCls, Label, Reveal, SelectInput, TextInput, useAction } from "@/components/board/fields";
import { TypePicker, type ExperimentType } from "@/components/board/TypePicker";
import { createAssumption, updateAssumption } from "@/app/assumptions/actions";
import { createCard } from "@/app/actions";

const CATEGORIES = ["customer", "problem", "solution", "channel", "revenue", "other"];
const STATUSES = ["untested", "testing", "supported", "refuted", "retired"];
const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: v }));
const range = (n: number) => Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

type Assumption = {
  id: string;
  statement: string;
  category: string;
  importance: number;
  evidence: number;
  willingnessToChange: number | null;
  status: string;
  notes: string | null;
};

export function AssumptionForm({ assumption: a }: { assumption: Assumption }) {
  const { run } = useAction();
  const save = (field: string) => (v: string) => run(() => updateAssumption(a.id, field, v));
  return (
    <div>
      <TextInput label="Assumption" value={a.statement} onSave={save("statement")} multiline required />
      {/* keyed on the saved values so the dropdowns follow changes made elsewhere (for example a decision) */}
      <div key={`${a.importance}-${a.evidence}-${a.status}-${a.category}-${a.willingnessToChange}`} className="grid gap-x-3 sm:grid-cols-3">
        <SelectInput label="Importance (1 to 5)" value={String(a.importance)} options={range(5)} onSave={save("importance")} blank="Choose..." />
        <SelectInput label="Evidence (1 to 5)" value={String(a.evidence)} options={range(5)} onSave={save("evidence")} blank="Choose..." />
        <SelectInput label="Status" value={a.status} options={opts(STATUSES)} onSave={save("status")} blank="Choose..." />
        <SelectInput label="Category" value={a.category} options={opts(CATEGORIES)} onSave={save("category")} blank="Choose..." />
        <SelectInput
          label="Willingness to change (coach, 1 to 10)"
          value={a.willingnessToChange != null ? String(a.willingnessToChange) : ""}
          options={range(10)}
          onSave={save("willingnessToChange")}
          blank="Not set"
        />
      </div>
      <p className="-mt-1 mb-3 text-xs text-muted">Evidence and status changes made here are added to the history below. Usually they change through a sprint&apos;s decision.</p>
      <TextInput label="Notes" value={a.notes} onSave={save("notes")} multiline />
    </div>
  );
}

export function NewAssumption() {
  const router = useRouter();
  const { run, pending } = useAction();
  const blank = { statement: "", category: "other", importance: 3, evidence: 1 };
  const [v, setV] = useState(blank);
  return (
    <Reveal label="New assumption">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createAssumption(v),
              (r) => r.ok && r.id && router.push(`/assumptions/${r.id}`),
            );
          }}
        >
          <textarea className={inputCls} rows={2} placeholder="We believe that..." value={v.statement} onChange={(e) => setV({ ...v, statement: e.target.value })} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Label text="Category">
              <select className={inputCls} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Label>
            <Label text="Importance (1 to 5)">
              <select className={inputCls} value={v.importance} onChange={(e) => setV({ ...v, importance: Number(e.target.value) })}>
                {range(5).map((o) => (
                  <option key={o.value}>{o.value}</option>
                ))}
              </select>
            </Label>
            <Label text="Evidence (1 to 5)">
              <select className={inputCls} value={v.evidence} onChange={(e) => setV({ ...v, evidence: Number(e.target.value) })}>
                {range(5).map((o) => (
                  <option key={o.value}>{o.value}</option>
                ))}
              </select>
            </Label>
          </div>
          <Button type="submit" kind="primary" disabled={pending || !v.statement.trim()}>
            Add assumption
          </Button>
        </form>
      )}
    </Reveal>
  );
}

/** Start a sprint that tests this assumption. */
export function TestThis({ assumptionId, types }: { assumptionId: string; types: ExperimentType[] }) {
  const router = useRouter();
  const { run } = useAction();
  return (
    <TypePicker
      types={types}
      placeholder="+ Start a sprint to test this"
      className="w-64"
      onPick={(typeId) => run(() => createCard(typeId, "", assumptionId), (r) => r.ok && r.id && router.push(`/?card=${r.id}`))}
    />
  );
}
