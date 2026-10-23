"use client";
// The logged-in role, for screens that turn read-only for the coach. The server enforces it too.
import { createContext, useContext } from "react";
import type { Role } from "@/lib/session";

const RoleContext = createContext<Role>("owner");

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** True when the coach is logged in: show everything, edit nothing (comments still work). */
export function useReadOnly() {
  return useContext(RoleContext) === "coach";
}

/** Disables every form control inside it for the coach. */
export function EditArea({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const readOnly = useReadOnly();
  return (
    <fieldset disabled={readOnly} className={`m-0 min-w-0 border-0 p-0 ${className}`}>
      {children}
    </fieldset>
  );
}
