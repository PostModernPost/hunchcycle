// Daily keep-alive for the Supabase free plan, which pauses a project after
// about a week without activity. Vercel Cron calls this once a day
// (vercel.json) and sends "Authorization: Bearer <CRON_SECRET>".
// It reads one row so the database sees real activity. It returns no data.
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await db.select({ one: sql`1` }).from(schema.experiments).limit(1);
  return NextResponse.json({ ok: true });
}
