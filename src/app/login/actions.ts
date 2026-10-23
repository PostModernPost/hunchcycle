"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { roleForPassword, SESSION_COOKIE, SESSION_DAYS, signSession } from "@/lib/session";

export async function login(_prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const role = roleForPassword(String(form.get("password") ?? ""));
  if (!role) return { error: "That password didn't work." };
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
