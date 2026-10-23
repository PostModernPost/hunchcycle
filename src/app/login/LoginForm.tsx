"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { inputCls } from "@/components/styles";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="mb-1 block text-xs font-medium text-muted">Sign in as</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["owner", "Owner", "Full editing"],
              ["coach", "Coach", "Read and comment"],
            ] as const
          ).map(([value, label, note]) => (
            <label key={value} className="cursor-pointer rounded-md border border-line px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-raised">
              <input type="radio" name="role" value={value} defaultChecked={value === "owner"} className="sr-only" />
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted">{note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Password</span>
        <input name="password" type="password" autoComplete="current-password" className={inputCls} />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-paper hover:brightness-110 disabled:opacity-60">
        Log in
      </button>
    </form>
  );
}
