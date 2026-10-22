"use client";
// Small inputs for the card drawer. Each saves on blur, only when the value changed.
import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { filled } from "@/lib/gates";
import { inputCls } from "@/components/styles";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export const ToastContext = createContext<(msg: string) => void>(() => {});

/** Runs a server action, shows any error, then refreshes the board data. */
export function useAction() {
  const router = useRouter();
  const toast = useContext(ToastContext);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    new Promise<ActionResult>((resolve) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) toast(r.error);
        router.refresh();
        after?.(r);
        resolve(r);
      }),
    );
  return { run, pending };
}

export { inputCls };

export function Label({ text, required, children }: { text: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {text}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}

const show = (v: string | number | null | undefined) => (typeof v === "number" ? String(v) : filled(v) ? (v as string) : "");

export function TextInput({
  label,
  value,
  onSave,
  multiline,
  required,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  type?: "text" | "number" | "date";
  placeholder?: string;
  disabled?: boolean;
}) {
  const initial = show(value);
  const [saved, setSaved] = useState(initial);
  const blur = (v: string) => {
    if (v === saved) return;
    setSaved(v);
    onSave(v);
  };
  const common = {
    defaultValue: initial,
    placeholder: placeholder ?? (required ? "Required" : ""),
    disabled,
    className: inputCls,
  };
  return (
    <Label text={label} required={required}>
      {multiline ? (
        <textarea {...common} rows={4} onBlur={(e) => blur(e.target.value)} />
      ) : (
        <input {...common} type={type} onBlur={(e) => blur(e.target.value)} />
      )}
    </Label>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onSave,
  required,
  blank = "Choose...",
}: {
  label: string;
  value: string | null | undefined;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  required?: boolean;
  blank?: string;
}) {
  return (
    <Label text={label} required={required}>
      <select className={inputCls} defaultValue={value ?? ""} onChange={(e) => onSave(e.target.value)}>
        <option value="">{blank}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  kind = "secondary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "quiet";
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-accent text-paper hover:brightness-110 disabled:bg-stone-300 disabled:text-muted",
    secondary: "border border-line bg-raised hover:border-stone-400 disabled:text-muted",
    quiet: "text-muted hover:text-ink",
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${styles}`}>
      {children}
    </button>
  );
}

/** A quiet "+ label" button that opens a form only when it is needed. */
export function Reveal({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="mt-1 text-sm text-accent hover:brightness-110" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  return (
    <div className="mt-2 rounded-md border border-dashed border-line p-3">
      {children(() => setOpen(false))}
      <button type="button" className="mt-2 text-xs text-muted hover:text-ink" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

export { dateInput } from "@/lib/format";
