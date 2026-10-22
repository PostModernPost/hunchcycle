"use client";
// Edit a person's fixed fields and segment tags. Each field saves when you click out of it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputCls, Label, Reveal, TextInput, useAction } from "@/components/board/fields";
import { createPerson, updatePerson } from "@/app/people/actions";

type Person = {
  id: string;
  name: string;
  gender: string | null;
  age: number | null;
  location: string | null;
  contact: string | null;
  channelFound: string | null;
  platform: string | null;
  fantasy: string | null;
  bettor: string | null;
  whereToFindOthers: string | null;
  notes: string | null;
  segments: string[];
};

export function PersonForm({ person: p }: { person: Person }) {
  const { run } = useAction();
  const save = (field: string) => (v: string) => run(() => updatePerson(p.id, field, v));
  return (
    <div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextInput label="Name" value={p.name} onSave={save("name")} required />
        <TextInput label="Contact" value={p.contact} onSave={save("contact")} />
        <TextInput label="Age" type="number" value={p.age} onSave={save("age")} />
        <TextInput label="Gender" value={p.gender} onSave={save("gender")} />
        <TextInput label="Location" value={p.location} onSave={save("location")} />
        <TextInput label="How we found them" value={p.channelFound} onSave={save("channelFound")} />
        <TextInput label="Platform" value={p.platform} onSave={save("platform")} />
        <TextInput label="Where to find others like them" value={p.whereToFindOthers} onSave={save("whereToFindOthers")} />
        <TextInput label="Fantasy" value={p.fantasy} onSave={save("fantasy")} />
        <TextInput label="Bettor" value={p.bettor} onSave={save("bettor")} />
      </div>
      <TextInput
        label="Segments (separate with commas)"
        value={p.segments.join(", ")}
        onSave={save("segments")}
        placeholder="e.g. lapsed home exerciser, fantasy player"
      />
      <TextInput label="Notes" value={p.notes} onSave={save("notes")} multiline />
    </div>
  );
}

export function NewPerson() {
  const { run, pending } = useAction();
  const router = useRouter();
  const [v, setV] = useState({ name: "", channelFound: "" });
  return (
    <Reveal label="Add a person">
      {() => (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createPerson(v),
              (r) => r.ok && r.id && router.push(`/people/${r.id}`),
            );
          }}
        >
          <Label text="Name" required>
            <input className={`${inputCls} w-56`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Label>
          <Label text="How we found them">
            <input className={`${inputCls} w-56`} value={v.channelFound} onChange={(e) => setV({ ...v, channelFound: e.target.value })} />
          </Label>
          <div className="pb-3">
            <Button type="submit" kind="primary" disabled={pending || !v.name.trim()}>
              Add person
            </Button>
          </div>
        </form>
      )}
    </Reveal>
  );
}

/** Average 1 to 10 score. Guessed scores (for example AI-assigned) are left out unless you include them. */
export function ScoreSummary({ asked, guessed }: { asked: number[]; guessed: number[] }) {
  const [include, setInclude] = useState(false);
  const list = include ? [...asked, ...guessed] : asked;
  const avg = list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <span>
        Average &quot;will use it&quot; score: <span className="font-semibold">{avg ?? "none yet"}</span>
        <span className="text-muted">
          {" "}
          (from {list.length} interview{list.length === 1 ? "" : "s"})
        </span>
      </span>
      {guessed.length > 0 && (
        <label className="flex items-center gap-1 text-muted">
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
          Include {guessed.length} guessed score{guessed.length === 1 ? "" : "s"} (unverified)
        </label>
      )}
    </div>
  );
}
