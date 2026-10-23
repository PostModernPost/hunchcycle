// Signed login cookie (BRIEF section 8). No user accounts: the cookie only says which password was used.
// Uses Web Crypto so the same code runs in middleware (edge) and in server components.

export type Role = "owner" | "coach";
export const SESSION_COOKIE = "hc_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** "role.expiresAt.signature" */
export async function signSession(role: Role): Promise<string> {
  const payload = `${role}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, expires, sig] = parts;
  if (role !== "owner" && role !== "coach") return null;
  if (!(Number(expires) > Date.now())) return null;
  const expected = await hmac(`${role}.${expires}`);
  // constant-time compare
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? role : null;
}

/** Which role a typed password unlocks, if any. */
export function roleForPassword(password: string): Role | null {
  const same = (a: string, b: string | undefined) => {
    if (!b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };
  if (same(password, process.env.OWNER_PASSWORD)) return "owner";
  if (same(password, process.env.COACH_PASSWORD)) return "coach";
  return null;
}
