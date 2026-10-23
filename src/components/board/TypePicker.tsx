"use client";
// Pick an experiment type, or add a new one on the spot.
import { useState } from "react";
import { createType } from "@/app/actions";
import { Button, inputCls, useAction } from "./fields";
import { useReadOnly } from "@/components/Role";

export type ExperimentType = { id: string; name: string; needsScript: boolean };

const NEW = "__new__";

export function TypePicker({
  types,
  value,
  onPick,
  placeholder = "Choose a type...",
  className = "",
}: {
  types: ExperimentType[];
  value?: string | null;
  onPick: (typeId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { run, pending } = useAction();
  const readOnly = useReadOnly();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [needsScript, setNeedsScript] = useState(false);
  const save = () =>
    run(
      () => createType(name, needsScript),
      (r) => {
        if (r.ok && r.id) {
          setAdding(false);
          setName("");
          onPick(r.id);
        }
      },
    );

  if (adding)
    return (
      // Not a <form>: this often sits inside another form (the toolbar's).
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <input
          autoFocus
          className={`${inputCls} w-48`}
          placeholder="New type, e.g. Referral"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={needsScript} onChange={(e) => setNeedsScript(e.target.checked)} />
          Uses an interview or survey script
        </label>
        <Button onClick={save} disabled={pending || !name.trim()}>
          Add type
        </Button>
        <Button kind="quiet" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );

  return (
    <select
      disabled={readOnly}
      className={`${inputCls.replace("w-full ", "")} ${className || "w-full"}`}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === NEW) setAdding(true);
        else if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
      <option value={NEW}>+ New type...</option>
    </select>
  );
}
