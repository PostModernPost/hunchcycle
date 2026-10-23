// Role checks for server components and server actions. Server only.
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";
import type { Result } from "@/lib/parse";

export async function getRole(): Promise<Role | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export const COACH_CANT_EDIT = "The coach login can read everything and comment, but can't make changes.";

/** Returns an error result unless the owner is logged in. Every editing action calls this first. */
export async function ownerOnly(): Promise<Result | null> {
  const role = await getRole();
  if (role === "owner") return null;
  return { ok: false, error: role === "coach" ? COACH_CANT_EDIT : "Please log in again." };
}
