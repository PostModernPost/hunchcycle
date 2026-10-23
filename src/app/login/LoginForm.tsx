"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { inputCls } from "@/components/styles";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Password</span>
        <input name="password" type="password" autoFocus autoComplete="current-password" className={inputCls} />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-paper hover:brightness-110 disabled:opacity-60">
        Log in
      </button>
    </form>
  );
}
