import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// DATABASE_URL is Supabase's session pooler (port 5432), locally and on Vercel;
// the transaction pooler hangs with postgres-js (DECISIONS, milestone 2).
// The free plan's session pooler has few connections to share between every
// running copy of the app, so each copy keeps a small pool and closes idle
// connections quickly. prepare: false keeps the transaction pooler possible.
const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
