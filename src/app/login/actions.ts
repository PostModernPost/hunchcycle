"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, SESSION_COOKIE, SESSION_DAYS, signSession, type Role } from "@/lib/session";

export async function login(_prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const chosen = form.get("role");
  if (chosen !== "owner" && chosen !== "coach") return { error: "Choose Owner or Coach." };
  const role: Role = chosen;
  if (!checkPassword(role, String(form.get("password") ?? ""))) return { error: `That isn't the ${role} password.` };
  (await cookies()).set(SESSION_COOKIE, await signSession(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
