// Everything is behind the login (BRIEF section 8), except the login page itself
// and the daily keep-alive, which checks its own secret (src/app/api/keepalive).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const role = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (role) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/keepalive|_next/static|_next/image|favicon.ico).*)"],
};
